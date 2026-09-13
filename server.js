'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const engine = require('./lib/engine');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

store.load();
engine.recomputeStatus();
engine.sampleMetrics();
store.save();

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  if (p === '/api/state' && req.method === 'GET') return json(res, 200, engine.snapshot());
  if (p === '/api/devices' && req.method === 'GET') return json(res, 200, store.db.devices);
  if (p === '/api/links' && req.method === 'GET') return json(res, 200, store.db.links);
  if (p === '/api/events' && req.method === 'GET') return json(res, 200, store.db.events);
  if (p === '/api/alerts' && req.method === 'GET') return json(res, 200, store.db.alerts);
  if (p === '/api/metrics' && req.method === 'GET') return json(res, 200, store.db.metrics);
  if (p === '/api/scenarios' && req.method === 'GET') return json(res, 200, store.db.scenarios);
  if (p === '/api/security' && req.method === 'GET') return json(res, 200, engine.securitySummary());

  if (p.startsWith('/api/scenario/') && req.method === 'POST') {
    const kind = p.split('/').pop();
    const result = engine.runScenario(kind);
    if (!result.ok) return json(res, 400, result);
    return json(res, 200, { ...result, state: engine.snapshot() });
  }

  if (p === '/api/poll' && req.method === 'POST') {
    engine.sampleMetrics();
    store.save();
    return json(res, 200, engine.snapshot());
  }

  if (p === '/api/reset' && req.method === 'POST') {
    store.reset();
    engine.recomputeStatus();
    engine.sampleMetrics();
    store.save();
    return json(res, 200, engine.snapshot());
  }

  if (p.startsWith('/api/')) return json(res, 404, { error: 'No such endpoint' });
  return serveStatic(res, p);
});

server.listen(PORT, () => {
  console.log(`Smart Campus digital twin running on http://localhost:${PORT}`);
});
