import type { Database } from 'bun:sqlite';

/**
 * Networks that use WPA2/WPA3 but do NOT advertise Protected Management
 * Frame capability (RSN capabilities MFP-capable bit = 0). Without PMF,
 * deauth and disassoc frames are unprotected, so the network is vulnerable
 * to forced-disconnect attacks even if the data plane is fully encrypted.
 *
 * We look at the first beacon per BSSID that has RSN info.
 */
export function pmfDisabled(db: Database, captureId: number): void {
  // Pick one beacon per BSSID that has rsn=true; check rsn_mfpc flag.
  const rows = db
    .query<{ bssid: string; ssid: string | null; ts_rel: number; raw_json: string }, [number]>(
      `SELECT bssid, ssid, ts_rel, raw_json FROM packets
       WHERE capture_id=? AND type=0 AND subtype=8 AND bssid IS NOT NULL
         AND raw_json LIKE '%"rsn":true%'
       GROUP BY bssid`
    )
    .all(captureId);

  if (rows.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'pmf_disabled', 'info', ?, ?, 1, ?, ?)`
  );

  for (const r of rows) {
    let extras: Record<string, unknown> = {};
    try { extras = JSON.parse(r.raw_json); } catch { /* skip */ }
    if (extras.rsn_mfpc === true) continue; // PMF capable — not vulnerable
    insert.run(
      captureId, r.ts_rel, r.ts_rel,
      JSON.stringify([r.bssid]),
      JSON.stringify({ bssid: r.bssid, ssid: r.ssid })
    );
  }
}
