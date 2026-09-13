-- Smart Campus Network — digital twin schema
-- The running app stores the same shape in data/twin.json. Use this file if you
-- want to move it onto SQLite, Postgres or MySQL without changing the API.

CREATE TABLE vlans (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  network   TEXT NOT NULL,
  gateway   TEXT NOT NULL,
  pool      TEXT
);

CREATE TABLE devices (
  id          TEXT PRIMARY KEY,           -- CORE-SW, SW-USERS, PC-STUDENT ...
  pt_name     TEXT NOT NULL,              -- exact label inside Packet Tracer
  type        TEXT NOT NULL,              -- router|core|switch|ap|pc|laptop|server|mobile|iot|unknown
  role        TEXT,
  vlan_id     INTEGER REFERENCES vlans(id),
  ip          TEXT,
  mac         TEXT,
  status      TEXT NOT NULL DEFAULT 'online',  -- online|warning|offline
  authorized  INTEGER NOT NULL DEFAULT 1,
  risk        TEXT NOT NULL DEFAULT 'low',     -- low|medium|high
  access      TEXT NOT NULL DEFAULT 'allow',   -- allow|deny|limited
  x           INTEGER,
  y           INTEGER,
  last_seen   TEXT
);

CREATE TABLE links (
  id         TEXT PRIMARY KEY,
  a_device   TEXT NOT NULL REFERENCES devices(id),
  a_port     TEXT NOT NULL,
  b_device   TEXT NOT NULL REFERENCES devices(id),
  b_port     TEXT NOT NULL,
  kind       TEXT NOT NULL,               -- uplink|access|wireless
  status     TEXT NOT NULL DEFAULT 'up'   -- up|down
);

CREATE TABLE events (
  id        TEXT PRIMARY KEY,
  ts        TEXT NOT NULL,
  type      TEXT NOT NULL,                -- link-down|device-down|performance|security|restore
  severity  TEXT NOT NULL,                -- info|low|medium|high
  device_id TEXT REFERENCES devices(id),
  link_id   TEXT REFERENCES links(id),
  message   TEXT NOT NULL
);

CREATE TABLE metrics (
  id           TEXT PRIMARY KEY,
  ts           TEXT NOT NULL,
  device_id    TEXT NOT NULL REFERENCES devices(id),
  latency_ms   REAL,
  packet_loss  REAL,
  availability REAL
);

CREATE TABLE alerts (
  id         TEXT PRIMARY KEY,
  ts         TEXT NOT NULL,
  severity   TEXT NOT NULL,
  title      TEXT NOT NULL,
  detail     TEXT,
  device_id  TEXT REFERENCES devices(id),
  status     TEXT NOT NULL DEFAULT 'active'   -- active|cleared
);

CREATE TABLE scenarios (
  id             TEXT PRIMARY KEY,
  kind           TEXT NOT NULL,           -- link-failure|device-failure|high-traffic|unauthorized-device
  name           TEXT NOT NULL,
  started_at     TEXT NOT NULL,
  ended_at       TEXT,
  problem        TEXT,
  affected       TEXT,                    -- comma separated device ids
  affected_count INTEGER,
  impact         TEXT,                    -- low|medium|high
  cause          TEXT,
  recommendation TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
);

-- Every step the automation engine took, so the decision path is auditable.
CREATE TABLE automation_runs (
  id       TEXT PRIMARY KEY,
  ts       TEXT NOT NULL,
  trigger  TEXT NOT NULL
);

CREATE TABLE automation_steps (
  run_id   TEXT NOT NULL REFERENCES automation_runs(id),
  ordinal  INTEGER NOT NULL,
  step     TEXT NOT NULL,                 -- Detect|Analyze|Decide|Action|Alert
  detail   TEXT NOT NULL,
  PRIMARY KEY (run_id, ordinal)
);

CREATE INDEX idx_events_ts       ON events(ts);
CREATE INDEX idx_metrics_device  ON metrics(device_id, ts);
CREATE INDEX idx_alerts_status   ON alerts(status, ts);
CREATE INDEX idx_links_a         ON links(a_device);
CREATE INDEX idx_links_b         ON links(b_device);
