import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.PCAP_DB ?? 'data/pcap-parser.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');

const MIGRATIONS: string[] = [
  `
  CREATE TABLE captures (
    id INTEGER PRIMARY KEY,
    filename TEXT NOT NULL,
    sha256 TEXT NOT NULL UNIQUE,
    bytes INTEGER NOT NULL,
    uploaded_at INTEGER NOT NULL,
    parsed_at INTEGER,
    status TEXT NOT NULL,
    packet_count INTEGER NOT NULL DEFAULT 0,
    first_ts_rel REAL,
    last_ts_rel REAL,
    has_radiotap INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    source TEXT NOT NULL
  );
  CREATE TABLE packets (
    id INTEGER PRIMARY KEY,
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    frame_no INTEGER NOT NULL,
    ts_rel REAL NOT NULL,
    type INTEGER NOT NULL,
    subtype INTEGER NOT NULL,
    type_name TEXT NOT NULL,
    ta TEXT, ra TEXT, sa TEXT, da TEXT, bssid TEXT,
    ssid TEXT, channel INTEGER, reason_code INTEGER,
    length INTEGER NOT NULL,
    retry INTEGER NOT NULL DEFAULT 0,
    protected INTEGER NOT NULL DEFAULT 0,
    raw_json TEXT NOT NULL
  );
  CREATE INDEX idx_packets_capture_ts ON packets(capture_id, ts_rel);
  CREATE INDEX idx_packets_capture_bssid ON packets(capture_id, bssid);
  CREATE INDEX idx_packets_capture_ta ON packets(capture_id, ta);
  CREATE INDEX idx_packets_capture_type ON packets(capture_id, type, subtype);

  CREATE TABLE networks (
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    bssid TEXT NOT NULL,
    ssid TEXT,
    channel INTEGER,
    encryption TEXT NOT NULL,
    vendor TEXT,
    country TEXT,
    beacon_count INTEGER NOT NULL DEFAULT 0,
    client_count INTEGER NOT NULL DEFAULT 0,
    first_seen REAL NOT NULL,
    last_seen REAL NOT NULL,
    PRIMARY KEY (capture_id, bssid)
  );

  CREATE TABLE devices (
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    mac TEXT NOT NULL,
    vendor TEXT,
    role TEXT NOT NULL,
    packets_tx INTEGER NOT NULL DEFAULT 0,
    packets_rx INTEGER NOT NULL DEFAULT 0,
    first_seen REAL NOT NULL,
    last_seen REAL NOT NULL,
    probed_ssids_json TEXT NOT NULL DEFAULT '[]',
    associated_bssids_json TEXT NOT NULL DEFAULT '[]',
    channels_json TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (capture_id, mac)
  );

  CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    capture_id INTEGER NOT NULL REFERENCES captures(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    ts_rel_start REAL NOT NULL,
    ts_rel_end REAL NOT NULL,
    count INTEGER NOT NULL,
    actors_json TEXT NOT NULL,
    details_json TEXT NOT NULL
  );
  CREATE INDEX idx_events_capture ON events(capture_id);
  `
];

export function migrate(): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)`);
  const applied = db.query<{ id: number }, []>(`SELECT id FROM _migrations`).all().map((r) => r.id);
  for (let i = 0; i < MIGRATIONS.length; i++) {
    if (applied.includes(i)) continue;
    db.transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.run(`INSERT INTO _migrations (id, applied_at) VALUES (?, ?)`, [i, Date.now()]);
    })();
  }
}

export function openTestDb(): Database {
  const t = new Database(':memory:');
  t.exec('PRAGMA foreign_keys = ON');
  for (const sql of MIGRATIONS) t.exec(sql);
  return t;
}
