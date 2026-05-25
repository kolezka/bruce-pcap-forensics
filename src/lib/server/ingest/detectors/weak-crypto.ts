import type { Database } from 'bun:sqlite';

/**
 * Networks with weak or no encryption: OPEN (no encryption at all) or WEP
 * (broken in 2001). High severity — these are immediately exploitable.
 */
export function weakCrypto(db: Database, captureId: number): void {
  const rows = db
    .query<{ bssid: string; ssid: string | null; encryption: string; first_seen: number; last_seen: number }, [number]>(
      `SELECT bssid, ssid, encryption, first_seen, last_seen FROM networks
       WHERE capture_id=? AND encryption IN ('OPEN', 'WEP')`
    )
    .all(captureId);

  if (rows.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'weak_crypto', 'high', ?, ?, 1, ?, ?)`
  );
  for (const r of rows) {
    insert.run(
      captureId,
      r.first_seen,
      r.last_seen,
      JSON.stringify([r.bssid]),
      JSON.stringify({ bssid: r.bssid, ssid: r.ssid, encryption: r.encryption })
    );
  }
}
