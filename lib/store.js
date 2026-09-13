'use strict';

const fs = require('fs');
const path = require('path');
const { DEVICES, LINKS, VLANS, REGISTRY } = require('./topology');

const FILE = path.join('data', 'twin.json');

// The six tables the brief asks for, plus vlans and a device registry that the
// Zero Trust check needs. Swap this file for schema.sql + SQLite and nothing
// above this layer has to change.
function blank() {
  return {
    devices: DEVICES.map((d) => ({
      ...d,
      status: 'online',        // online | warning | offline
      authorized: true,
      risk: 'low',             // low | medium | high
      access: 'allow',         // allow | deny | limited
      lastSeen: new Date().toISOString(),
    })),
    links: LINKS.map((l) => ({ ...l, status: 'up' })), // up | down
    vlans: VLANS,
    registry: REGISTRY.slice(),
    events: [],
    metrics: [],
    alerts: [],
    scenarios: [],
    automation: [],
    seq: { event: 0, alert: 0, scenario: 0, metric: 0, run: 0 },
  };
}

let db = null;

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    db = blank();
    save();
  }
  return db;
}

function save() {
  try { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); } catch (e) { /* read-only filesystem (e.g. Cloudflare Workers) - keep state in memory */ }
}

function reset() {
  db = blank();
  save();
  return db;
}

const nextId = (kind, prefix) => {
  db.seq[kind] += 1;
  return `${prefix}${String(db.seq[kind]).padStart(4, '0')}`;
};

function addEvent({ type, severity, deviceId = null, linkId = null, message }) {
  const row = {
    id: nextId('event', 'EV-'),
    ts: new Date().toISOString(),
    type, severity, deviceId, linkId, message,
  };
  db.events.unshift(row);
  db.events = db.events.slice(0, 300);
  return row;
}

function addAlert({ severity, title, detail, deviceId = null }) {
  const row = {
    id: nextId('alert', 'AL-'),
    ts: new Date().toISOString(),
    severity, title, detail, deviceId, status: 'active',
  };
  db.alerts.unshift(row);
  return row;
}

function clearAlerts() {
  db.alerts.forEach((a) => { a.status = 'cleared'; });
}

function addScenario(row) {
  const full = { id: nextId('scenario', 'SC-'), startedAt: new Date().toISOString(), ...row };
  db.scenarios.unshift(full);
  return full;
}

function addMetrics(rows) {
  const ts = new Date().toISOString();
  rows.forEach((m) => {
    db.metrics.unshift({ id: nextId('metric', 'MT-'), ts, ...m });
  });
  db.metrics = db.metrics.slice(0, 600);
}

function addAutomationRun(run) {
  const full = { id: nextId('run', 'AU-'), ts: new Date().toISOString(), ...run };
  db.automation.unshift(full);
  db.automation = db.automation.slice(0, 40);
  return full;
}

const device = (id) => db.devices.find((d) => d.id === id);
const link = (id) => db.links.find((l) => l.id === id);

module.exports = {
  load, save, reset, addEvent, addAlert, clearAlerts,
  addScenario, addMetrics, addAutomationRun, device, link,
  get db() { return db; },
};
