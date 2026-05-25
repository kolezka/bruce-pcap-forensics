import { test, expect } from 'bun:test';
import { openTestDb } from '../src/lib/server/db';

test('migration creates all tables', () => {
  const db = openTestDb();
  const tables = db
    .query<{ name: string }, []>(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map((r) => r.name);
  expect(tables).toEqual(expect.arrayContaining(['captures', 'packets', 'networks', 'devices', 'events']));
});

test('cascading delete removes packets', () => {
  const db = openTestDb();
  db.run(
    `INSERT INTO captures (filename, sha256, bytes, uploaded_at, status, source) VALUES (?, ?, ?, ?, ?, ?)`,
    ['a.pcap', 'h1', 100, 1, 'ready', 'upload']
  );
  const id = (db.query<{ id: number }, []>(`SELECT id FROM captures`).get() as { id: number }).id;
  db.run(
    `INSERT INTO packets (capture_id, frame_no, ts_rel, type, subtype, type_name, length, raw_json) VALUES (?,?,?,?,?,?,?,?)`,
    [id, 1, 0, 0, 8, 'beacon', 200, '{}']
  );
  db.run(`DELETE FROM captures WHERE id=?`, [id]);
  const c = (db.query<{ c: number }, []>(`SELECT count(*) c FROM packets`).get() as { c: number }).c;
  expect(c).toBe(0);
});
