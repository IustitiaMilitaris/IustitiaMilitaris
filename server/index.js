import { installCustomScenarios } from './custom-scenarios.js';
import { securityHeaders, rateLimit, sameOrigin, parseJson } from './security.js';
import { installClassroom } from './classroom.js';
import os from 'node:os';
import { installAccounts } from './accounts.js';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const authLimit = rateLimit(12, 15 * 60000);
app.disable('x-powered-by');
app.use(securityHeaders);
app.use('/api', rateLimit(600, 60000), (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && !sameOrigin(req)) return res.status(403).json({ error: 'forbidden' });
  next();
});
app.use(['/api/auth/login', '/api/auth/register'], (req, res, next) => req.method === 'POST' ? authLimit(req, res, next) : next());
app.use('/api/scenarios/custom', express.json({ limit: '256kb', verify: (req,res,buffer) => { parseJson(buffer.toString('utf8')); } }));
app.use(express.json({ limit: '64kb', verify: (req, res, buffer) => { parseJson(buffer.toString('utf8')); } }));
const dataDirectory = process.env.DATA_DIR || path.join(__dirname, 'data');
const repository = await installCustomScenarios(app, dataDirectory);
await installAccounts(app, dataDirectory, repository.scenarios);
const server = http.createServer(app);
server.headersTimeout = 15000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;

const PORT = process.env.PORT || 3000;

const rooms = installClassroom(server, repository);

// Serve frontend build from dist
const distPath = path.join(__dirname, '..', 'dist');
app.use((req, res, next) => {
  if (/^\/(?:server|docs|stsenarii|node_modules)(?:\/|$)/.test(req.path) || req.path.split('/').some(part => part.startsWith('.'))) return res.sendStatus(404);
  next();
});
app.use(express.static(distPath, { dotfiles: 'deny' }));

// API health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    zeroPii: true,
    timestamp: Date.now()
  });
});

function lanUrls() {
  return Object.entries(os.networkInterfaces())
    .sort(
      ([a], [b]) =>
        /docker|veth|vmnet|virbr|tun/i.test(a) -
        /docker|veth|vmnet|virbr|tun/i.test(b)
    )
    .flatMap(([, addresses]) => addresses || [])
    .filter((a) => a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a.address}:${PORT}`);
}
app.get('/api/server-info', (req, res) => {
  const urls = lanUrls();
  const host = req.headers.host || '';
  const origin = `${req.protocol}://${host}`;
  res.json({
    lanUrls: urls,
    preferredOrigin: /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host)
      ? urls[0] || origin
      : origin
  });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'notFound' }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/ws') || path.extname(req.path))
    return res.sendStatus(404);
  res.sendFile(path.join(distPath, 'index.html'));
});
app.use((error, req, res, next) =>
  res.status([400, 403, 413, 503].includes(error.status) ? error.status : 500).json({ error: error.status === 413 ? 'payloadTooLarge' : error.status < 500 ? 'invalidRequest' : 'serverError' })
);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Local: http://localhost:${PORT}`);
  for (const url of lanUrls()) console.log(`Network (LAN): ${url}`);
});
