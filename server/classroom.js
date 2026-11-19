import { constantEqual, sameOrigin, parseJson } from './security.js';
import { randomBytes, randomInt } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { WebSocketServer } from 'ws';
export function installClassroom(server, directory) {
  const scenarios = new Map(
    readdirSync(directory)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const s = JSON.parse(readFileSync(`${directory}/${f}`, 'utf8'));
        return [s.id, s];
      })
  );
  const rooms = new Map();
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024, verifyClient: info => sameOrigin(info.req) && wss.clients.size < 1000 });
  const send = (ws, data) => {
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  };
  const publicRoom = (room, role) => ({
    timerMode: room.timerMode,
    timerDurationSec: room.timerDurationSec,
    timerStartedAt: room.timerStartedAt,
    timerFinishedAt: room.timerFinishedAt,
    serverNow: Date.now(),
    code: room.code,
    scenarioId: room.scenarioId,
    currentNodeId: room.currentNodeId,
    phase: room.phase,
    selectedVariantId: room.selectedVariantId,
    votes:
      room.phase === 'voting' && role === 'student' && !room.showLive
        ? {}
        : room.votes,
    showLive: room.showLive,
    totalVotes: Object.values(room.votes).reduce((a, b) => a + b, 0),
    participantsCount: new Set(
      [...room.clients].filter((c) => c.role === 'student').map((c) => c.token)
    ).size,
    history: room.history,
    discussionIndex: room.index
  });
  const broadcast = (room) => {
    for (const ws of room.clients)
      send(ws, {
        type: 'ROOM_UPDATE',
        room: publicRoom(room, ws.role),
        hasVoted: room.voters.has(ws.token)
      });
  };
  const close = (room) => {
    for (const ws of room.clients) send(ws, { type: 'SESSION_CLOSED' });
    room.clients.clear();
    rooms.delete(room.code);
  };
  const timer = setInterval(() => {
    for (const room of rooms.values())
      if (Date.now() - room.updated > 4 * 3600000) close(room);
  }, 60000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  wss.on('connection', (ws, request) => {
    if (request.headers.origin) {
      try {
        if (new URL(request.headers.origin).host !== request.headers.host) {
          ws.close(1008);
          return;
        }
      } catch {
        ws.close(1008);
        return;
      }
    }
    ws.on('error', () => {});
    let joined;
    let messages = 0, windowStart = Date.now();
    ws.on('message', (raw) => {
      try {
        if (Date.now() - windowStart > 1000) { windowStart = Date.now(); messages = 0; }
        if (++messages > 120) { ws.close(1008, 'rateLimit'); return; }
        const data = parseJson(raw.toString());
        if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.type !== 'string') throw Error('invalidMessage');
        const allowed = ['CREATE_ROOM','JOIN_ROOM','SUBMIT_VOTE','SET_LIVE','OPEN_VOTING','SHOW_RESULTS','DISCUSS','NEXT_STAGE','CLOSE_SESSION'];
        if (!allowed.includes(data.type)) throw Error('invalidMessage');
        if (data.type === 'CREATE_ROOM' && (typeof data.scenarioId !== 'string' || !/^S[0-9]{2}$/.test(data.scenarioId))) throw Error('invalidMessage');
        if (data.clientVoteToken !== undefined && (typeof data.clientVoteToken !== 'string' || !/^[a-zA-Z0-9-]{20,100}$/.test(data.clientVoteToken))) throw Error('invalidMessage');
        if (data.variantId !== undefined && (typeof data.variantId !== 'string' || !/^[A-Z][0-9]?$/.test(data.variantId))) throw Error('invalidMessage');
        if (data.hostSecret !== undefined && (typeof data.hostSecret !== 'string' || !/^[a-f0-9]{64}$/.test(data.hostSecret))) throw Error('invalidMessage');
        if (data.type === 'SET_LIVE' && typeof data.showLive !== 'boolean') throw Error('invalidMessage');
        if (data.type === 'CREATE_ROOM' && data.timerMode !== undefined && !['none', '10m', '15m'].includes(data.timerMode)) throw Error('invalidMessage');
        if (data.type === 'CREATE_ROOM') {
          if (joined || !scenarios.has(data.scenarioId) || rooms.size >= 100)
            return;
          let code;
          do {
            code = String(randomInt(100000, 1000000));
          } while (rooms.has(code));
          const room = {
            timerMode: data.timerMode || 'none',
            timerDurationSec: data.timerMode === '10m' ? 600 : data.timerMode === '15m' ? 900 : 0,
            timerStartedAt: null,
            timerFinishedAt: null,
            code,
            scenarioId: data.scenarioId,
            currentNodeId: scenarios.get(data.scenarioId).pochatkovyi_vuzol,
            phase: 'briefing',
            showLive: true,
            hostSecret: randomBytes(32).toString('hex'),
            clients: new Set([ws]),
            voters: new Set(),
            votes: {},
            history: [],
            index: 0,
            updated: Date.now()
          };
          rooms.set(code, room);
          joined = room;
          ws.role = 'host';
          send(ws, {
            type: 'ROOM_CREATED',
            hostSecret: room.hostSecret,
            room: publicRoom(room)
          });
          return;
        }
        if (data.type === 'JOIN_ROOM') {
          if (typeof data.roomCode !== 'string' || !/^[0-9]{6}$/.test(data.roomCode)) throw Error('invalidMessage');
          const room = rooms.get(data.roomCode);
          if (!room) {
            send(ws, { type: 'ERROR', error: 'roomMissing' });
            return;
          }
          if (data.hostSecret && !constantEqual(data.hostSecret, room.hostSecret)) {
            send(ws, { type: 'ERROR', error: 'forbidden' });
            return;
          }
          if (
            !data.hostSecret &&
            (typeof data.clientVoteToken !== 'string' || !/^[a-zA-Z0-9-]{20,100}$/.test(data.clientVoteToken))
          )
            return;
          if (room.clients.size >= 500 && !room.clients.has(ws)) { send(ws, { type: 'ERROR', error: 'roomFull' }); return; }
          if (joined) joined.clients.delete(ws);
          joined = room;
          ws.role = data.hostSecret ? 'host' : 'student';
          ws.token = data.clientVoteToken;
          room.clients.add(ws);
          room.updated = Date.now();
          broadcast(room);
          return;
        }
        if (!joined || !rooms.has(joined.code)) return;
        const room = joined;
        const node = scenarios
          .get(room.scenarioId)
          .vuzly.find((n) => n.id === room.currentNodeId);
        if (data.type === 'SUBMIT_VOTE') {
          if (
            ws.role !== 'student' ||
            room.phase !== 'voting' ||
            room.voters.has(ws.token) ||
            !node.varianty.some((v) => v.id === data.variantId)
          )
            return;
          room.updated = Date.now();
          room.voters.add(ws.token);
          room.votes[data.variantId] = (room.votes[data.variantId] || 0) + 1;
          const total = Object.values(room.votes).reduce((a, b) => a + b, 0),
            counts = Object.values(room.votes),
            k = counts.length;
          room.index =
            k < 2
              ? 0
              : Math.round(
                  ((1 - counts.reduce((a, c) => a + (c / total) ** 2, 0)) /
                    (1 - 1 / k)) *
                    100
                ) / 100;
          broadcast(room);
          return;
        }
        if (ws.role !== 'host' || !constantEqual(data.hostSecret, room.hostSecret)) {
          send(ws, { type: 'ERROR', error: 'forbidden' });
          return;
        }
        room.updated = Date.now();
        if (data.type === 'SET_LIVE') {
          room.showLive = Boolean(data.showLive);
          broadcast(room);
          return;
        }
        if (data.type === 'OPEN_VOTING' && room.phase === 'briefing') {
          room.timerStartedAt = Date.now();
          room.phase = 'voting';
        }
        else if (data.type === 'SHOW_RESULTS' && room.phase === 'voting')
          room.phase = 'results';
        else if (
          data.type === 'DISCUSS' &&
          ['results', 'feedback'].includes(room.phase) &&
          node.varianty.some((v) => v.id === data.variantId)
        ) {
          room.selectedVariantId = data.variantId;
          room.phase = 'feedback';
        } else if (data.type === 'NEXT_STAGE' && room.phase === 'feedback') {
          const variant = node.varianty.find(
            (v) => v.id === room.selectedVariantId
          );
          room.history.push({
            nodeId: node.id,
            selectedVariantId: variant.id,
            votes: { ...room.votes },
            discussionIndex: room.index
          });
          if (!variant.nastupnyi_vuzol) { room.phase = 'finished'; room.timerFinishedAt = Date.now(); }
          else {
            room.currentNodeId = variant.nastupnyi_vuzol;
            room.phase = 'voting';
            room.votes = {};
            room.voters.clear();
            room.index = 0;
            room.selectedVariantId = null;
          }
        } else if (data.type === 'CLOSE_SESSION') {
          close(room);
          return;
        } else return;
        broadcast(room);
      } catch {
        send(ws, { type: 'ERROR', error: 'invalidMessage' });
      }
    });
    ws.on('close', () => {
      if (joined) {
        joined.clients.delete(ws);
        broadcast(joined);
      }
    });
  });
  return rooms;
}
