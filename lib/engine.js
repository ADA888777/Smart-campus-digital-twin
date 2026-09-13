'use strict';

// Digital-twin engine. Everything below runs against the in-memory model of the
// Packet Tracer topology declared in lib/topology.js. There is no integration
// with Packet Tracer and no polling of real equipment: device states, faults,
// alerts and metrics are all produced by this simulation.

const store = require('./store');
const { ROOT } = require('./topology');

const FORWARDERS = new Set(['core', 'switch', 'router', 'ap']);

/* ------------------------------------------------------------------ *
 * Reachability: walk out from the core over links that are up and
 * through devices that are still forwarding. Anything we cannot reach
 * is offline, which is what makes one shutdown command take four PCs
 * down with it.
 * ------------------------------------------------------------------ */
function recomputeStatus(extraFailed = new Set()) {
  const db = store.db;
  // A device failure is recorded on the device record itself, so the blast radius
  // is always recomputed from the topology and never lost on a later call.
  db.devices.forEach((d) => { if (extraFailed.has(d.id)) d.failed = true; });
  const failedDevices = new Set(db.devices.filter((d) => d.failed).map((d) => d.id));
  const adj = new Map();
  db.devices.forEach((d) => adj.set(d.id, []));
  db.links.forEach((l) => {
    if (l.status !== 'up') return;
    adj.get(l.a)?.push(l.b);
    adj.get(l.b)?.push(l.a);
  });

  const reachable = new Set();
  if (!failedDevices.has(ROOT)) {
    const queue = [ROOT];
    reachable.add(ROOT);
    while (queue.length) {
      const cur = queue.shift();
      const curDev = db.devices.find((d) => d.id === cur);
      // A dead switch stops forwarding; endpoints are leaves anyway.
      if (cur !== ROOT && (!curDev || !FORWARDERS.has(curDev.type))) continue;
      if (failedDevices.has(cur)) continue;
      for (const nb of adj.get(cur) || []) {
        if (reachable.has(nb)) continue;
        reachable.add(nb);
        queue.push(nb);
      }
    }
  }

  const offline = [];
  db.devices.forEach((d) => {
    const down = failedDevices.has(d.id) || !reachable.has(d.id);
    d.status = down ? 'offline' : (d.status === 'warning' ? 'warning' : 'online');
    if (down) offline.push(d.id);
    else d.lastSeen = new Date().toISOString();
  });
  // Report everything that is currently unreachable, not only what changed on
  // this pass, so re-running a scenario still shows the true blast radius.
  return { reachable, offline };
}

function health() {
  const db = store.db;
  const total = db.devices.length;
  const score = db.devices.reduce((acc, d) => acc + (d.status === 'online' ? 1 : d.status === 'warning' ? 0.5 : 0), 0);
  return Math.round((score / total) * 100);
}

function offlineDevices() {
  return store.db.devices.filter((d) => d.status === 'offline');
}

// Simulated telemetry. Latency, packet loss and availability are generated here
// from the modelled device state. They are not read from Packet Tracer and they
// are not measurements taken from real hardware.
function sampleMetrics() {
  const rows = store.db.devices
    .filter((d) => FORWARDERS.has(d.type) || d.type === 'server')
    .map((d) => {
      if (d.status === 'offline') return { deviceId: d.id, latencyMs: null, packetLoss: 100, availability: 0 };
      if (d.status === 'warning') return { deviceId: d.id, latencyMs: 60 + Math.round(Math.random() * 40), packetLoss: 3 + Math.round(Math.random() * 5), availability: 92 };
      return { deviceId: d.id, latencyMs: 4 + Math.round(Math.random() * 10), packetLoss: 0, availability: 100 };
    });
  // Flagged so nothing downstream can mistake these for real measurements.
  rows.forEach((r) => { r.simulated = true; r.source = 'twin-simulation'; });
  store.addMetrics(rows);
  return rows;
}

/* ------------------------------------------------------------------ *
 * Fault analysis: the part that turns "a switch is down" into a cause
 * and a recommendation.
 * ------------------------------------------------------------------ */
const RULES = {
  'link-failure': {
    problem: 'Link failure',
    cause: 'Uplink interface shut down or cable fault between the core and the access switch',
    recommendation: 'Check the uplink cable and run "no shutdown" on the interface at both ends.',
  },
  'device-failure': {
    problem: 'Device failure',
    cause: 'Access switch powered off or its uplink interface is administratively down',
    recommendation: 'Check switch power and status, then verify the uplink interface.',
  },
  'high-traffic': {
    problem: 'Performance degradation',
    cause: 'Traffic load between the user VLANs and the server VLAN is above the normal range',
    recommendation: 'Identify the top talkers and consider rate limiting or scheduling heavy transfers.',
  },
  'unauthorized-device': {
    problem: 'Unauthorised device detected',
    cause: 'A device that is not in the registry joined the guest wireless network',
    recommendation: 'Keep the device denied, record its MAC, and confirm whether it belongs to a known user.',
  },
};

function severityFor(count) {
  if (count >= 4) return 'high';
  if (count >= 1) return 'medium';
  return 'low';
}

function analyse(kind, affectedIds) {
  const rule = RULES[kind];
  const impact = kind === 'high-traffic' ? 'medium' : severityFor(affectedIds.length);
  return {
    problem: rule.problem,
    affected: affectedIds,
    affectedCount: affectedIds.length,
    impact,
    cause: rule.cause,
    recommendation: rule.recommendation,
  };
}

/* ------------------------------------------------------------------ *
 * Automation: detect -> analyse -> decide -> act -> alert.
 * Every scenario runs through it, so the trace on the dashboard is the
 * real decision path, not an illustration.
 * ------------------------------------------------------------------ */
function runWorkflow({ trigger, detect, analysis, decision, action, alert }) {
  const steps = [
    { step: 'Detect', detail: detect },
    { step: 'Analyze', detail: `${analysis.problem} · ${analysis.affectedCount} device(s) affected · impact ${analysis.impact.toUpperCase()}` },
    { step: 'Decide', detail: decision },
    { step: 'Action', detail: action },
    { step: 'Alert', detail: alert },
  ];
  return store.addAutomationRun({ trigger, steps });
}

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */
function runScenario(kind) {
  const db = store.db;

  if (kind === 'restore') {
    // Full reset of the twin: links, devices, faults, alerts, automation and metrics.
    db.links = db.links.filter((l) => l.b !== 'UNKNOWN-01');
    db.links.forEach((l) => { l.status = 'up'; });
    db.devices = db.devices.filter((d) => d.id !== 'UNKNOWN-01');
    db.devices.forEach((d) => { d.status = 'online'; d.risk = 'low'; d.access = 'allow'; d.authorized = true; d.failed = false; });
    db.scenarios.forEach((s) => { if (s.status === 'active') { s.status = 'resolved'; s.resolvedAt = new Date().toISOString(); } });
    db.metrics = [];
    db.automation = [];
    recomputeStatus();
    store.clearAlerts();
    store.addEvent({ type: 'restore', severity: 'info', message: 'Network restored to its normal state' });
    sampleMetrics();
    store.save();
    return { ok: true, kind, analysis: null };
  }

  if (kind === 'link-failure') {
    const l = store.link('L3'); // CORE-SW Fa0/3  <->  SW-USERS Fa0/1
    l.status = 'down';
    const { offline } = recomputeStatus();
    const analysis = analyse(kind, offline);
    store.addEvent({ type: 'link-down', severity: analysis.impact, linkId: l.id, message: `Link ${l.a} ${l.aPort} to ${l.b} ${l.bPort} went down` });
    const alert = store.addAlert({ severity: analysis.impact, title: 'Link down: core to SW-USERS', detail: `${analysis.affectedCount} devices lost connectivity`, deviceId: 'SW-USERS' });
    const sc = store.addScenario({ kind, name: 'Link failure', ...analysis, status: 'active' });
    runWorkflow({
      trigger: 'Link state change on CORE-SW Fa0/3',
      detect: `Interface ${l.aPort} on ${l.a} reported line protocol down`,
      analysis,
      decision: 'Fault is a single uplink, not a device — isolate the branch and notify',
      action: `Marked ${analysis.affectedCount} devices offline in the twin and opened ${alert.id}`,
      alert: 'Alert raised for the network team with the recommended fix',
    });
    sampleMetrics();
    store.save();
    return { ok: true, kind, analysis, scenario: sc };
  }

  if (kind === 'device-failure') {
    const failed = new Set(['SW-USERS']);
    const { offline } = recomputeStatus(failed);
    const analysis = analyse(kind, offline);
    store.addEvent({ type: 'device-down', severity: analysis.impact, deviceId: 'SW-USERS', message: 'SW-USERS stopped responding' });
    const alert = store.addAlert({ severity: analysis.impact, title: 'Device offline: SW-USERS', detail: `${analysis.affectedCount} devices behind this switch are unreachable`, deviceId: 'SW-USERS' });
    const sc = store.addScenario({ kind, name: 'Device failure', ...analysis, status: 'active' });
    runWorkflow({
      trigger: 'SW-USERS missed three consecutive polls',
      detect: 'No response from SW-USERS on the management VLAN',
      analysis,
      decision: 'Whole switch is unreachable — escalate above a single-link fault',
      action: `Marked the switch and ${Math.max(analysis.affectedCount - 1, 0)} endpoints offline in the twin, opened ${alert.id}`,
      alert: 'High-impact alert sent with power and uplink checks attached',
    });
    sampleMetrics();
    store.save();
    return { ok: true, kind, analysis, scenario: sc };
  }

  if (kind === 'high-traffic') {
    ['CORE-SW', 'SW-USERS', 'SW-SERVERS', 'SRV-WEB'].forEach((id) => {
      const d = store.device(id);
      if (d && d.status !== 'offline') d.status = 'warning';
    });
    const analysis = analyse(kind, ['CORE-SW', 'SW-USERS', 'SW-SERVERS', 'SRV-WEB']);
    store.addEvent({ type: 'performance', severity: 'medium', message: 'Latency and packet loss rose on the user-to-server path' });
    const alert = store.addAlert({ severity: 'medium', title: 'Performance degraded', detail: 'Latency above the normal range between the user VLANs and the servers', deviceId: 'CORE-SW' });
    const sc = store.addScenario({ kind, name: 'High traffic', ...analysis, status: 'active' });
    runWorkflow({
      trigger: 'Latency crossed the warning threshold on CORE-SW',
      detect: 'Round-trip time and packet loss above the recorded baseline',
      analysis,
      decision: 'Service is degraded but still up — warn rather than isolate',
      action: `Four devices set to degraded in the twin and ${alert.id} opened`,
      alert: 'Performance alert raised with the affected path listed',
    });
    sampleMetrics();
    store.save();
    return { ok: true, kind, analysis, scenario: sc };
  }

  if (kind === 'unauthorized-device') {
    if (!store.device('UNKNOWN-01')) {
      db.devices.push({
        id: 'UNKNOWN-01', pt: 'Unknown device', type: 'unknown', role: 'Not registered',
        vlan: 60, ip: '192.168.60.44', x: 810, y: 450,
        status: 'online', authorized: false, risk: 'high', access: 'deny',
        mac: '00E0.F7A2.5C10', lastSeen: new Date().toISOString(),
      });
      db.links.push({ id: 'L99', a: 'AP-GUEST', aPort: 'wlan', b: 'UNKNOWN-01', bPort: 'Wireless0', kind: 'wireless', status: 'up' });
    }
    const analysis = analyse(kind, ['UNKNOWN-01']);
    analysis.impact = 'high';
    store.addEvent({ type: 'security', severity: 'high', deviceId: 'UNKNOWN-01', message: 'Unregistered device joined the guest wireless network' });
    const alert = store.addAlert({ severity: 'high', title: 'Unauthorised device denied', detail: 'MAC 00E0.F7A2.5C10 is not in the device registry — access denied', deviceId: 'UNKNOWN-01' });
    const sc = store.addScenario({ kind, name: 'Unauthorised device', ...analysis, status: 'active' });
    runWorkflow({
      trigger: 'New MAC seen on AP-GUEST',
      detect: 'MAC 00E0.F7A2.5C10 associated with the guest SSID',
      analysis,
      decision: 'Identity unknown and device not registered — Zero Trust denies by default',
      action: `Twin updated: UNKNOWN-01 flagged unauthorised, access set to DENY and risk to HIGH inside the twin, ${alert.id} opened`,
      alert: 'Security alert raised for the network team',
    });
    sampleMetrics();
    store.save();
    return { ok: true, kind, analysis, scenario: sc };
  }

  return { ok: false, error: `Unknown scenario: ${kind}` };
}

function securitySummary() {
  const d = store.db.devices;
  return {
    authorized: d.filter((x) => x.authorized).length,
    unauthorized: d.filter((x) => !x.authorized).length,
    highRisk: d.filter((x) => x.risk === 'high').length,
    blocked: d.filter((x) => x.access === 'deny').length,
  };
}

function snapshot() {
  const db = store.db;
  return {
    health: health(),
    devices: db.devices,
    links: db.links,
    vlans: db.vlans,
    events: db.events.slice(0, 40),
    alerts: db.alerts.filter((a) => a.status === 'active'),
    metrics: db.metrics.slice(0, 60),
    scenarios: db.scenarios.slice(0, 10),
    automation: db.automation.slice(0, 5),
    security: securitySummary(),
    offline: offlineDevices().map((x) => x.id),
  };
}

module.exports = { recomputeStatus, runScenario, snapshot, health, securitySummary, sampleMetrics };
