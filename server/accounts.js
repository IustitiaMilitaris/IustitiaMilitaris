import { installStats } from './stats.js';
import { parseJson, constantEqual } from './security.js';
import { promisify } from 'node:util';
import { readdirSync, readFileSync } from 'node:fs';
const defaultScenarioNodes = new Map(
  readdirSync(new URL('../stsenarii/', import.meta.url))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const s = JSON.parse(
        readFileSync(new URL('../stsenarii/' + f, import.meta.url), 'utf8')
      );
      return [s.id, s];
    })
);
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  createHmac
} from 'node:crypto';
import { mkdir, readFile, writeFile, rename, chmod } from 'node:fs/promises';
import path from 'node:path';
const hashPassword = promisify(scrypt);

export async function installAccounts(app, directory, scenarioNodesOverride, scenarioKeyFor = () => undefined) {
  const scenarioNodes = scenarioNodesOverride || defaultScenarioNodes;
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, 'store.json');
  let store;
  try {
    store = parseJson(await readFile(file, 'utf8'));
    await chmod(file, 0o600);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    store = { users: [], sessions: {}, progress: {}, aggregateStats: {} };
  }
  store.aggregateStats ||= {};
  let secret = process.env.SESSION_SECRET;
  if (!secret) {
    const secretFile = path.join(directory, '.secret');
    try {
      secret = await readFile(secretFile, 'utf8');
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      secret = randomBytes(48).toString('hex');
      await writeFile(secretFile, secret, { mode: 0o600, flag: 'wx' });
    }
    await chmod(secretFile, 0o600);
  }
  if (Buffer.byteLength(secret) < 32) throw Error('Session secret must contain at least 32 bytes');
  let queue = Promise.resolve();
  let pendingWrites = 0;
  const update = (fn) => {
    if (pendingWrites >= 128) return Promise.reject(Object.assign(Error('busy'), { status: 503 }));
    pendingWrites++;
    const task = queue.then(async () => {
      const draft = structuredClone(store);
      const result = await fn(draft);
      const tmp = file + '.tmp';
      await writeFile(tmp, JSON.stringify(draft), { mode: 0o600 });
      await rename(tmp, file);
      store = draft;
      return result;
    });
    queue = task.catch(() => {});
    return task.finally(() => { pendingWrites--; });
  };
  const sign = (token) =>
    createHmac('sha256', secret).update(token).digest('hex');
  const equal = constantEqual;
  const tokenOf = (req) => {
    const value = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('eds_session='))
      ?.slice(12);
    if (!value) return null;
    if (value.length > 256) return null;
    const pieces = value.split('.');
    const [token, signature] = pieces;
    if (pieces.length !== 2 || !/^[a-f0-9]{64}~[0-9]{13}$/.test(token) || !equal(sign(token), signature)) return null;
    return Number(token.split('~')[1]) > Date.now() ? token : null;
  };
  const identity = (req) => {
    const token = tokenOf(req);
    const session = token && Object.hasOwn(store.sessions, token) ? store.sessions[token] : null;
    return session && session.expires > Date.now() ? session.userId : null;
  };
  const cookie = (res, req, value, age) =>
    res.setHeader(
      'Set-Cookie',
      `eds_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`
    );
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  for (const action of ['register', 'login'])
    app.post(
      `/api/auth/${action}`,
      wrap(async (req, res) => {
        const { login, password } = req.body || {};
        if (
          typeof login !== 'string' ||
          !/^[a-zA-Z0-9_-]{3,32}$/.test(login) ||
          typeof password !== 'string' ||
          password.length < 6 ||
          password.length > 128
        )
          return res.status(400).json({ error: 'credentialsFormat' });
        const normalized = login.toLowerCase();
        const expires = Date.now() + 7 * 86400000;
        const token = randomBytes(32).toString('hex') + '~' + expires;
        const outcome = await update(async (draft) => {
          let user = draft.users.find(
            (u) => u.login.toLowerCase() === normalized
          );
          if (action === 'register') {
            if (user) return { error: 'loginTaken' };
            const salt = randomBytes(16).toString('hex');
            user = {
              id: randomBytes(16).toString('hex'),
              login,
              salt,
              hash: (await hashPassword(password, salt, 64)).toString('hex')
            };
            draft.users.push(user);
          } else {
            const computed = (await hashPassword(
              password,
              user?.salt || 'missing-user',
              64
            )).toString('hex');
            if (!user || !equal(computed, user.hash))
              return { error: 'invalidCredentials' };
          }
          for (const [key, s] of Object.entries(draft.sessions))
            if (s.expires < Date.now()) delete draft.sessions[key];
          draft.sessions[token] = {
            userId: user.id,
            expires
          };
          return { login: user.login };
        });
        if (outcome.error)
          return res.status(action === 'register' ? 409 : 401).json(outcome);
        cookie(res, req, `${token}.${sign(token)}`, 604800);
        res.json(outcome);
      })
    );
  app.get('/api/auth/me', (req, res) => {
    const user = store.users.find((u) => u.id === identity(req));
    res.json({ user: user ? { login: user.login } : null });
  });
  app.post(
    '/api/auth/logout',
    wrap(async (req, res) => {
      const token = tokenOf(req);
      await update((d) => {
        if (token) delete d.sessions[token];
      });
      cookie(res, req, '', 0);
      res.json({ ok: true });
    })
  );
  installStats(app, scenarioNodes, () => store.aggregateStats || {}, update, scenarioKeyFor);
  app.get('/api/progress', (req, res) => {
    const id = identity(req);
    if (!id) return res.status(401).json({ error: 'unauthorized' });
    res.json(store.progress[id] || {});
  });
  app.post(
    '/api/progress',
    wrap(async (req, res) => {
      const id = identity(req);
      if (!id) return res.status(401).json({ error: 'unauthorized' });
      const { scenarioId, pathway, notes, timing, caseKey } = req.body || {};
      if (
        !/^S\d{2}$/.test(scenarioId || '') ||
        (timing !== undefined && (!timing || ![0,10,15].includes(timing.mode) || !Number.isInteger(timing.elapsedSeconds) || timing.elapsedSeconds < 0 || timing.elapsedSeconds > 31536000 || Object.keys(timing).some(k => !['mode','elapsedSeconds'].includes(k)))) ||
        !Array.isArray(pathway) ||
        pathway.length > 100 ||
        (notes !== undefined &&
          (typeof notes !== 'string' || notes.length > 4000)) ||
        pathway.some(
          (p) =>
            !p ||
            typeof p !== 'object' ||
            !/^V\d+$/.test(p.nodeId || '') ||
            !/^[A-Z][0-9]?$/.test(p.variantId || '')
        )
      )
        return res.status(400).json({ error: 'invalidProgress' });
      if(/^S(0[4-9]|[1-9][0-9])$/.test(scenarioId)&&!scenarioNodes.has(scenarioId))return res.status(409).json({error:'staleScenario'});
      if(scenarioKeyFor(scenarioId)!==undefined&&caseKey!==scenarioKeyFor(scenarioId))return res.status(409).json({error:'staleScenario'});
      const scenarioSnapshot=scenarioNodes.get(scenarioId);
      await update((d) => {
        d.progress[id] ||= {};
        const previous = d.progress[id][scenarioId];
        const changed =
          JSON.stringify(previous?.pathway) !== JSON.stringify(pathway);
        const last = pathway[pathway.length - 1];
        const complete =
          last &&
          scenarioSnapshot
            ?.vuzly.find((n) => n.id === last.nodeId)
            ?.varianty.find((v) => v.id === last.variantId)?.nastupnyi_vuzol ===
            null;
        const now = new Date().toISOString();
        d.progress[id][scenarioId] = {
          pathway: pathway.map((p) => ({
            nodeId: p.nodeId,
            variantId: p.variantId
          })),
          notes: notes ?? previous?.notes ?? '',
          ...((timing || (!changed && previous?.timing)) ? {timing: timing || previous.timing} : {}),
          updatedAt: changed ? now : previous?.updatedAt || now,
          ...(complete
            ? { completedAt: (!changed && previous?.completedAt) || now }
            : {})
        };
      });
      res.json({ ok: true });
    })
  );
  return {remapScenarios: async(mapping,deletedId)=>update(d=>{
    const remap=source=>{const result=Object.fromEntries(Object.entries(source||{}).filter(([id])=>!/^S(0[4-9]|[1-9][0-9])$/.test(id)));for(const [oldId,newId]of Object.entries(mapping))if(oldId!==deletedId&&source?.[oldId])result[newId]=source[oldId];return result;};
    for(const userId of Object.keys(d.progress||{}))d.progress[userId]=remap(d.progress[userId]);
    d.aggregateStats=remap(d.aggregateStats);
  })};

}
