'use strict';

const $ = (s) => document.querySelector(s);
const SVG_NS = 'http://www.w3.org/2000/svg';
const INFRA = new Set(['router', 'core', 'switch']);
const box = (d) => (INFRA.has(d.type) ? { w: 108, h: 34, font: 12 } : { w: 88, h: 30, font: 10 });

let state = null;

/* ---------------- topology ---------------- */
function drawMap() {
  const svg = $('#map');
  svg.textContent = '';
  const byId = new Map(state.devices.map((d) => [d.id, d]));

  const edges = document.createElementNS(SVG_NS, 'g');
  state.links.forEach((l) => {
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (!a || !b) return;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y + box(a).h / 2);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y - box(b).h / 2);
    line.setAttribute('class', `edge ${l.status === 'down' ? 'down' : ''} ${l.kind === 'wireless' ? 'wireless' : ''}`.trim());
    edges.appendChild(line);
  });
  svg.appendChild(edges);

  state.devices.forEach((d) => {
    const g = document.createElementNS(SVG_NS, 'g');
    const cls = !d.authorized ? 'unknown' : d.status;
    g.setAttribute('class', `node ${cls}`);

    const m = box(d);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', d.x - m.w / 2);
    rect.setAttribute('y', d.y - m.h / 2);
    rect.setAttribute('width', m.w);
    rect.setAttribute('height', m.h);
    rect.setAttribute('rx', 6);
    rect.setAttribute('class', `node-box ${d.type === 'core' ? 'core' : ''}`.trim());
    g.appendChild(rect);

    const pip = document.createElementNS(SVG_NS, 'circle');
    pip.setAttribute('cx', d.x - m.w / 2 + 10);
    pip.setAttribute('cy', d.y);
    pip.setAttribute('class', `pip ${cls}`);
    g.appendChild(pip);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', d.x - m.w / 2 + 19);
    label.setAttribute('y', d.y + 4);
    label.setAttribute('class', 'node-label');
    label.setAttribute('font-size', m.font);
    label.textContent = d.id;
    g.appendChild(label);

    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${d.id} — ${d.pt}\n${d.role}\nVLAN ${d.vlan ?? '—'} · ${d.ip}\nstate: ${d.status}`;
    g.appendChild(title);

    svg.appendChild(g);
  });

  const down = state.links.filter((l) => l.status === 'down').length;
  const off = state.offline.length;
  $('#mapNote').textContent = down === 0 && off === 0
    ? 'All links up'
    : `${down} link${down === 1 ? '' : 's'} down · ${off} device${off === 1 ? '' : 's'} offline`;
}

/* ---------------- panels ---------------- */
function drawHealth() {
  const h = state.health;
  $('#health').textContent = h;
  const fill = $('#healthFill');
  fill.style.width = `${h}%`;
  fill.style.background = h >= 90 ? 'var(--ok)' : h >= 60 ? 'var(--warn)' : 'var(--down)';
  const pulse = $('#pulse');
  pulse.style.background = h >= 90 ? 'var(--ok)' : h >= 60 ? 'var(--warn)' : 'var(--down)';
  pulse.classList.remove('beat');
  void pulse.offsetWidth;
  pulse.classList.add('beat');
}

function drawFault() {
  const el = $('#fault');
  const sc = state.scenarios.find((s) => s.status === 'active');
  if (!sc) {
    el.className = 'fault empty';
    el.textContent = 'Nothing to analyse. The network is running normally.';
    return;
  }
  el.className = 'fault';
  el.innerHTML = `
    <dl>
      <dt>Problem</dt><dd>${sc.problem}</dd>
      <dt>Affected</dt><dd class="mono">${sc.affected.length ? sc.affected.join(', ') : '—'}</dd>
      <dt>Devices</dt><dd class="mono">${sc.affectedCount}</dd>
      <dt>Impact</dt><dd><span class="pill ${sc.impact}">${sc.impact}</span></dd>
      <dt>Probable cause</dt><dd>${sc.cause}</dd>
      <dt>Recommendation</dt><dd>${sc.recommendation}</dd>
    </dl>`;
}

function drawSecurity() {
  const s = state.security;
  const rows = [
    ['Authorised devices', s.authorized, false],
    ['Unauthorised', s.unauthorized, s.unauthorized > 0],
    ['High risk', s.highRisk, s.highRisk > 0],
    ['Blocked', s.blocked, s.blocked > 0],
  ];
  $('#security').innerHTML = rows.map(([k, v, flag]) =>
    `<div><dt>${k}</dt><dd class="${flag ? 'flagged' : ''}">${v}</dd></div>`).join('');
}

const IDLE_FLOW = [
  ['Detect', 'Polling devices and links'],
  ['Analyze', 'No fault to analyse'],
  ['Decide', 'No decision pending'],
  ['Action', 'No action taken'],
  ['Alert', 'No alert raised'],
];

function drawAutomation() {
  const run = state.automation[0];
  const flow = $('#flow');
  if (!run) {
    $('#autoTrigger').textContent = 'Waiting for a trigger.';
    flow.className = 'flow idle';
    flow.innerHTML = IDLE_FLOW.map(([s, d]) => `<li><b>${s}</b><span>${d}</span></li>`).join('');
    return;
  }
  $('#autoTrigger').textContent = run.trigger;
  flow.className = 'flow';
  flow.innerHTML = run.steps.map((s) => `<li class="on"><b>${s.step}</b><span>${s.detail}</span></li>`).join('');
}

function drawDevices() {
  const tbody = $('#devices tbody');
  const colour = (d) => !d.authorized ? 'var(--risk)' : d.status === 'online' ? 'var(--ok)' : d.status === 'warning' ? 'var(--warn)' : 'var(--down)';
  const label = (d) => !d.authorized ? 'unauthorised' : d.status;
  tbody.innerHTML = state.devices.map((d) => `
    <tr>
      <td class="id">${d.id}</td>
      <td>${d.pt}</td>
      <td class="id">${d.vlan ?? '—'}</td>
      <td class="id">${d.ip}</td>
      <td class="state"><span><i style="background:${colour(d)}"></i>${label(d)}</span></td>
    </tr>`).join('');
  const online = state.devices.filter((d) => d.status === 'online').length;
  $('#devCount').textContent = `${online} of ${state.devices.length} online`;
}

function drawLog() {
  const time = (ts) => new Date(ts).toLocaleTimeString([], { hour12: false });
  const items = [
    ...state.alerts.map((a) => ({ ts: a.ts, sev: a.severity, text: `${a.title} — ${a.detail}` })),
    ...state.events.map((e) => ({ ts: e.ts, sev: e.severity, text: e.message })),
  ].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 30);

  $('#log').innerHTML = items.length
    ? items.map((i) => `<li><time>${time(i.ts)}</time><span class="sev ${i.sev}">${i.sev}</span><span>${i.text}</span></li>`).join('')
    : '<li><span class="empty">No events yet. Run a scenario to generate one.</span></li>';
}

function render() {
  drawHealth(); drawMap(); drawFault(); drawSecurity();
  drawAutomation(); drawDevices(); drawLog();
}

/* ---------------- wiring ---------------- */
async function load() {
  const res = await fetch('/api/state');
  state = await res.json();
  render();
}

async function run(kind, btn) {
  const buttons = document.querySelectorAll('.runs button');
  buttons.forEach((b) => { b.disabled = true; });
  btn.textContent = 'Running…';
  const original = btn.dataset.label;
  try {
    const res = await fetch(`/api/scenario/${kind}`, { method: 'POST' });
    const body = await res.json();
    state = body.state || state;
    render();
  } finally {
    btn.textContent = original;
    buttons.forEach((b) => { b.disabled = false; });
  }
}

document.querySelectorAll('.runs button').forEach((btn) => {
  btn.dataset.label = btn.textContent;
  btn.addEventListener('click', () => run(btn.dataset.scenario, btn));
});

// Keeps the metrics moving the way a monitoring system would.
setInterval(async () => {
  const res = await fetch('/api/poll', { method: 'POST' });
  state = await res.json();
  drawHealth();
}, 15000);

load();
