import fixtures from './scenarios.cjs';
const { scenarios, route: caseRoute } = fixtures;
const firstCase = scenarios[0];
import WebSocket from 'ws';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
try {
  await access(new URL('../dist/index.html', import.meta.url));
} catch {
  const build = spawnSync('npm', ['run', 'build'], {
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  assert.equal(build.status, 0);
}
const directory = await mkdtemp(path.join(tmpdir(), 'ethical-host-'));
const port = 18374;
const child = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(port), DATA_DIR: directory },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
child.stderr.on('data', (chunk) => {
  output += chunk;
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(Error(output || 'server startup timeout')),
      10000
    );
    child.once('exit', () => {
      clearTimeout(timeout);
      reject(Error(output));
    });
    child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('Local:')) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const request = (url, data, cookie) =>
    fetch(base + url, {
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {})
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
  const alice = await request('/api/auth/register', {
    login: 'test-alias',
    password: 'secure-pass'
  });
  assert.equal(alice.status, 200);
  const cookie = alice.headers.get('set-cookie').split(';')[0];
  assert.ok(alice.headers.get('set-cookie').includes('HttpOnly'));
  assert.ok(!alice.headers.get('set-cookie').includes('Secure'));
  assert.equal(
    (
      await request('/api/auth/register', {
        login: 'test-alias',
        password: 'secure-pass'
      })
    ).status,
    409
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        login: 'test-alias',
        password: 'wrong-pass'
      })
    ).status,
    401
  );
  assert.equal(
    (
      await request('/api/auth/login', {
        login: 'test-alias',
        password: 'secure-pass'
      })
    ).status,
    200
  );
  assert.equal(
    (
      await request(
        '/api/progress',
        { scenarioId: firstCase.id, pathway: caseRoute(firstCase).slice(0, 1) },
        cookie
      )
    ).status,
    200
  );
  assert.equal(
    (await (await request('/api/progress', null, cookie)).json()).S01.pathway[0]
      .variantId,
    'A1'
  );
  await request('/api/progress',{scenarioId:'S01',pathway:caseRoute(firstCase)},cookie);
  const completed=(await(await request('/api/progress',null,cookie)).json()).S01;assert.ok(completed.completedAt);
  await request('/api/progress',{scenarioId:'S01',pathway:completed.pathway,notes:'note'},cookie);assert.equal((await(await request('/api/progress',null,cookie)).json()).S01.completedAt,completed.completedAt);
  const bob = await request('/api/auth/register', {
    login: 'other-alias',
    password: 'secure-pass'
  });
  const other = bob.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(
    await (
      await request('/api/progress?userId=test-alias', null, other)
    ).json(),
    {}
  );
  assert.equal((await request('/api/progress')).status, 401);
  assert.equal(
    (await request('/api/progress', null, cookie + 'invalid')).status,
    401
  );
  await Promise.all(
    scenarios.map(s => s.id).map((scenarioId) =>
      request(
        '/api/progress',
        { scenarioId, pathway: [], notes: 'private note' },
        cookie
      )
    )
  );
  const saved = await (await request('/api/progress', null, cookie)).json();
  for (const id of scenarios.map(s => s.id))
    assert.equal(saved[id].notes, 'private note');
  const info = await (await request('/api/server-info')).json();
  assert.ok(Array.isArray(info.lanUrls));
  assert.ok(info.preferredOrigin.startsWith('http://'));
  assert.ok((await (await request('/builder')).text()).includes('id="root"'));
  assert.equal((await request('/api/missing')).status, 404);
  assert.equal((await request('/missing.js')).status, 404);
  await request('/api/auth/logout', {}, cookie);
  assert.equal((await request('/api/progress', null, cookie)).status, 401);
  const sockets = [];
  const hostSecrets = new WeakMap();
  const connect = async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    sockets.push(ws);
    ws.on('message', raw => { const message = JSON.parse(raw); if (message.type === 'ROOM_CREATED') hostSecrets.set(ws, message.hostSecret); });
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    return ws;
  };
  const wait = (ws, predicate) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.off('message', listener);
        reject(Error('WebSocket response timeout'));
      }, 3000);
      const listener = (raw) => {
        const data = JSON.parse(raw);
        if (predicate(data)) {
          clearTimeout(timeout);
          ws.off('message', listener);
          resolve(data);
        }
      };
      ws.on('message', listener);
    });
  const send = (ws, data) => ws.send(JSON.stringify({ ...data, ...(hostSecrets.has(ws) ? { hostSecret: hostSecrets.get(ws) } : {}) }));
  try {
    for (const mode of ['none', '10m', '15m']) {
      const timedHost = await connect();
      let response = wait(timedHost, m => m.type === 'ROOM_CREATED');
      send(timedHost, { type: 'CREATE_ROOM', scenarioId: 'S01', timerMode: mode });
      const created = await response;
      assert.equal(created.room.timerMode, mode);
      assert.equal(created.room.timerDurationSec, mode === '10m' ? 600 : mode === '15m' ? 900 : 0);
      assert.equal(created.room.timerStartedAt, null);
      response = wait(timedHost, m => m.error === 'forbidden');
      timedHost.send(JSON.stringify({type:'SET_TIMER_MODE',timerMode:'15m',hostSecret:'0'.repeat(64)}));
      await response;
      response = wait(timedHost, m => m.room?.timerMode === mode);
      send(timedHost, {type:'SET_TIMER_MODE', timerMode:mode});
      assert.equal((await response).room.timerStartedAt, null);
      response = wait(timedHost, m => m.room?.phase === 'voting');
      send(timedHost, { type: 'OPEN_VOTING' });
      const opened = await response;
      assert.ok(opened.room.timerStartedAt >= created.room.serverNow);
      const rejoined = await connect();
      response = wait(rejoined, m => Boolean(m.room));
      send(rejoined, {type:'JOIN_ROOM',roomCode:created.room.code,clientVoteToken:'c'.repeat(32)});
      assert.equal((await response).room.timerStartedAt, opened.room.timerStartedAt);
      response = wait(rejoined, m => m.error === 'forbidden');
      send(rejoined, {type:'SET_TIMER_MODE',timerMode:'none'});
      await response;
      response = wait(timedHost, m => m.error === 'invalidMessage');
      send(timedHost, {type:'SET_TIMER_MODE',timerMode:'none'});
      await response;
      response = wait(timedHost, m => m.type === 'SESSION_CLOSED');
      send(timedHost, {type:'CLOSE_SESSION'});
      await response;
    }
    const host = await connect();
    let pending = wait(host, (m) => m.type === 'ROOM_CREATED');
    send(host, { type: 'CREATE_ROOM', scenarioId: 'S01' });
    let state = await pending;
    const code = state.room.code;
    assert.match(code, /^\d{6}$/);
    assert.ok(state.hostSecret);
    assert.equal(state.room.phase, 'briefing');
    const token = 'a'.repeat(32),
      token2 = 'b'.repeat(32);
    const one = await connect(),
      two = await connect();
    pending = wait(one, (m) => m.room?.participantsCount === 1);
    send(one, { type: 'JOIN_ROOM', roomCode: code, clientVoteToken: token });
    await pending;
    pending = wait(two, (m) => m.room?.participantsCount === 2);
    send(two, { type: 'JOIN_ROOM', roomCode: code, clientVoteToken: token2 });
    await pending;
    pending = wait(one, (m) => m.error === 'forbidden');
    send(one, { type: 'OPEN_VOTING' });
    await pending;
    pending = wait(host, (m) => m.room?.phase === 'voting');
    send(host, { type: 'OPEN_VOTING' });
    await pending;
    pending = wait(one, (m) => m.hasVoted && m.room.totalVotes === 1);
    send(one, { type: 'SUBMIT_VOTE', variantId: 'A1' });
    await pending;
    send(one, { type: 'SUBMIT_VOTE', variantId: 'B1' });
    pending = wait(host, (m) => m.room?.totalVotes === 2);
    send(two, { type: 'SUBMIT_VOTE', variantId: 'B1' });
    state = await pending;
    assert.deepEqual(state.room.votes, { A1: 1, B1: 1 });
    assert.equal(state.room.discussionIndex, 1);
    assert.ok(!JSON.stringify(state.room).includes(token));
    assert.ok(!('hostSecret' in state.room));
    pending = wait(two,m => m.room?.showLive === false); send(host,{type:'SET_LIVE',showLive:false}); const hidden=await pending; assert.deepEqual(hidden.room.votes,{}); assert.equal(hidden.room.totalVotes,2);
    pending=wait(two,m=>m.room?.showLive===true);send(host,{type:'SET_LIVE',showLive:true});assert.deepEqual((await pending).room.votes,{A1:1,B1:1});
    one.close();
    const rejoined = await connect();
    pending = wait(rejoined, (m) => m.room);
    send(rejoined, {
      type: 'JOIN_ROOM',
      roomCode: code,
      clientVoteToken: token
    });
    state = await pending;
    assert.equal(state.hasVoted, true);
    assert.equal(state.room.totalVotes, 2);
    pending = wait(host, (m) => m.room?.phase === 'results');
    send(host, { type: 'SHOW_RESULTS' });
    await pending;
    pending = wait(
      host,
      (m) => m.room?.phase === 'feedback' && m.room.selectedVariantId === 'B1'
    );
    send(host, { type: 'DISCUSS', variantId: 'B1' });
    await pending;
    pending = wait(host, (m) => m.room?.selectedVariantId === 'A1');
    send(host, { type: 'DISCUSS', variantId: 'A1' });
    await pending;
    pending = wait(two, (m) => m.room?.currentNodeId === 'V2');
    send(host, { type: 'NEXT_STAGE', nextNodeId: 'V8' });
    state = await pending;
    assert.equal(state.room.phase, 'voting');
    assert.equal(state.room.totalVotes, 0);
    assert.equal(state.hasVoted, false);
    for (const variantId of caseRoute(firstCase).slice(1).map(step => step.variantId)) {
      pending = wait(host, (m) => m.room?.phase === 'results');
      send(host, { type: 'SHOW_RESULTS' });
      await pending;
      pending = wait(host, (m) => m.room?.phase === 'feedback');
      send(host, { type: 'DISCUSS', variantId });
      await pending;
      pending = wait(
        host,
        (m) => m.room?.phase === 'voting' || m.room?.phase === 'finished'
      );
      send(host, { type: 'NEXT_STAGE' });
      state = await pending;
    }
    assert.equal(state.room.phase, 'finished');
    assert.equal(state.room.history.length, 6);
    pending = wait(two, (m) => m.type === 'SESSION_CLOSED');
    send(host, { type: 'CLOSE_SESSION' });
    await pending;
    assert.equal((await (await request('/api/health')).json()).activeRooms, 0);

    for (const scenario of scenarios) {
      for (const branch of scenario.id === 'S01' ? [1, 2, 3] : [0]) {
        const facilitator = await connect();
        const action = async (body, condition) => {
          const result = wait(facilitator, condition);
          send(facilitator, body);
          return result;
        };
        await action({ type: 'CREATE_ROOM', scenarioId: scenario.id }, m => m.type === 'ROOM_CREATED');
        await action({ type: 'OPEN_VOTING' }, m => m.room?.phase === 'voting');
        const steps = caseRoute(scenario, branch);
        for (const [index, step] of steps.entries()) {
          await action({ type: 'SHOW_RESULTS' }, m => m.room?.phase === 'results');
          await action({ type: 'DISCUSS', variantId: step.variantId }, m => m.room?.phase === 'feedback');
          const expected = index === steps.length - 1 ? 'finished' : 'voting';
          const result = await action({ type: 'NEXT_STAGE', nextNodeId: 'V999' }, m => m.room?.phase === expected);
          assert.equal(result.room.history.length, index + 1);
          if (expected === 'voting') assert.equal(result.room.currentNodeId, steps[index + 1].nodeId);
          for (const key of ['user', 'userId', 'login', 'name', 'email', 'ip', 'rank', 'device'])
            assert.ok(!(key in result.room));
        }
        await action({ type: 'CLOSE_SESSION' }, m => m.type === 'SESSION_CLOSED');
      }
    }
    assert.equal((await (await request('/api/health')).json()).activeRooms, 0);
  } finally {
    for (const ws of sockets) ws.terminate();
  }
  for (const route of [
    '/',
    '/auth',
    '/norms',
    '/builder/S01',
    '/scenarios/S01/play',
    '/classroom',
    '/classroom/host/123456',
    '/classroom/join/123456'
  ])
    assert.ok(
      (await (await request(route)).text()).includes('id="root"'),
      route
    );
  console.log(
    'PASS: complete WebSocket session, two guests, duplicate prevention, reconnect, host authorisation, final summary and cleanup'
  );
  console.log(
    'PASS: local accounts, password verification, session logout, progress isolation, LAN info and SPA fallback'
  );
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) =>
    child.exitCode !== null ? resolve() : child.once('exit', resolve)
  );
  await rm(directory, { recursive: true, force: true });
}
