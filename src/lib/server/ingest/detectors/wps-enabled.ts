import type { Database } from 'bun:sqlite';

/**
 * Networks advertising WPS (Wi-Fi Protected Setup) in their beacons. WPS-PIN
 * is famously vulnerable to Pixie Dust (offline PIN recovery) and bruteforce
 * (8-digit PIN, structurally reducible to ~11000 attempts). Surfacing it
 * here so the analyst notices the attack surface.
 */
export function wpsEnabled(db: Database, captureId: number): void {
  // Beacons carrying any wps_* field were tagged in raw_extras as wpa/rsn-ish;
  // we instead look directly in the packet raw_json for the wps_wps_state
  // marker which is what tshark emits.
  const rows = db
    .query<{ bssid: string; ssid: string | null; ts_rel: number }, [number]>(
      `SELECT bssid, ssid, ts_rel FROM packets
       WHERE capture_id=? AND type=0 AND subtype=8 AND raw_json LIKE '%"wps":true%' AND bssid IS NOT NULL
       GROUP BY bssid`
    )
    .all(captureId);

  if (rows.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'wps_enabled', 'info', ?, ?, 1, ?, ?)`
  );
  for (const r of rows) {
    insert.run(
      captureId,
      r.ts_rel,
      r.ts_rel,
      JSON.stringify([r.bssid]),
      JSON.stringify({ bssid: r.bssid, ssid: r.ssid })
    );
  }
}
