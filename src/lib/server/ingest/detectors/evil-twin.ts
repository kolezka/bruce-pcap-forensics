import type { Database } from 'bun:sqlite';

/**
 * Same SSID present on ≥2 different BSSIDs. Real-world causes:
 *   - Legitimate mesh / multi-AP deployments (false positive)
 *   - Actual evil-twin attack (rogue AP cloning a known SSID)
 * Severity warn — surfaces the suspicion without claiming intent.
 */
export function evilTwin(db: Database, captureId: number): void {
  const groups = db
    .query<{ ssid: string; bssids_csv: string; count: number; first_seen: number; last_seen: number }, [number]>(
      `SELECT ssid, GROUP_CONCAT(bssid) AS bssids_csv, COUNT(*) AS count,
              MIN(first_seen) AS first_seen, MAX(last_seen) AS last_seen
       FROM networks
       WHERE capture_id=? AND ssid IS NOT NULL AND ssid <> ''
       GROUP BY ssid
       HAVING COUNT(*) >= 2`
    )
    .all(captureId);

  if (groups.length === 0) return;
  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'evil_twin', 'warn', ?, ?, ?, ?, ?)`
  );
  for (const g of groups) {
    const bssids = g.bssids_csv.split(',');
    insert.run(
      captureId,
      g.first_seen,
      g.last_seen,
      g.count,
      JSON.stringify(bssids),
      JSON.stringify({ ssid: g.ssid, bssids })
    );
  }
}
