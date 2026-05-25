import type { Database } from 'bun:sqlite';

export function channelHopping(db: Database, captureId: number): void {
  const devs = db
    .query<{ mac: string; channels_json: string; first_seen: number; last_seen: number }, [number]>(
      `SELECT mac, channels_json, first_seen, last_seen FROM devices WHERE capture_id=?`
    )
    .all(captureId);
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'channel_hopping', 'info', ?, ?, ?, ?, ?)`
  );
  for (const d of devs) {
    let chans: number[] = [];
    try { chans = JSON.parse(d.channels_json); } catch { /* skip */ }
    if (chans.length >= 3) {
      insert.run(
        captureId, d.first_seen, d.last_seen, chans.length,
        JSON.stringify([d.mac]),
        JSON.stringify({ mac: d.mac, channels: chans })
      );
    }
  }
}
