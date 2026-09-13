// Cloudflare Workers entry point: same routes as server.js, running at the edge.
// Static assets are served from ./public through the assets binding in wrangler.toml.
import _store from '../lib/store.js';
import _engine from '../lib/engine.js';
const store = _store.default || _store;
const engine = _engine.default || _engine;
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
let booted = false;
const boot = () => { if (booted) return; store.load(); engine.recomputeStatus(); engine.sampleMetrics(); store.save(); booted = true; };
const GET_ROUTES = { '/api/state': () => engine.snapshot(), '/api/devices': () => store.db.devices, '/api/links': () => store.db.links, '/api/events': () => store.db.events, '/api/alerts': () => store.db.alerts, '/api/metrics': () => store.db.metrics, '/api/scenarios': () => store.db.scenarios, '/api/security': () => engine.securitySummary() };
const POST_ROUTES = { '/api/poll': () => { engine.sampleMetrics(); store.save(); return engine.snapshot(); }, '/api/reset': () => { store.reset(); engine.recomputeStatus(); engine.sampleMetrics(); store.save(); return engine.snapshot(); } };
const handle = (request, env) => { boot(); const p = new URL(request.url).pathname; const m = request.method; if (m === 'GET' && GET_ROUTES[p]) return json(GET_ROUTES[p]()); if (m === 'POST' && POST_ROUTES[p]) return json(POST_ROUTES[p]()); if (m === 'POST' && p.startsWith('/api/scenario/')) { const r = engine.runScenario(p.split('/').pop()); return r.ok ? json({ ...r, state: engine.snapshot() }) : json(r, 400); } if (p.startsWith('/api/')) return json({ error: 'No such endpoint' }, 404); return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 }); };
export default { fetch: handle };
