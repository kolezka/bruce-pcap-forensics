import type { Database } from 'bun:sqlite';

const THRESHOLD = 20;

export function karma(db: Database, captureId: number): void {
  const devs = db
    .query<{ mac: string; probed_ssids_json: string; first_seen: number; last_seen: number }, [number]>(
      `SELECT mac, probed_ssids_json, first_seen, last_seen FROM devices WHERE capture_id=?`
    )
    .all(captureId);
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'karma', 'warn', ?, ?, ?, ?, ?)`
  );
  for (const d of devs) {
    let arr: string[] = [];
    try { arr = JSON.parse(d.probed_ssids_json); } catch { /* skip */ }
    if (arr.length >= THRESHOLD) {
      insert.run(
        captureId, d.first_seen, d.last_seen, arr.length,
        JSON.stringify([d.mac]),
        JSON.stringify({ mac: d.mac, ssid_count: arr.length, sample: arr.slice(0, 10) })
      );
    }
  }
}
