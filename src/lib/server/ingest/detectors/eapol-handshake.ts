import type { Database } from 'bun:sqlite';

interface Row { frame_no: number; ts_rel: number; ta: string | null; ra: string | null; bssid: string | null; raw_json: string; }

/**
 * Detect EAPOL 4-way handshakes. For each unique (AP, STA) pair we:
 *   1. record an `eapol_handshake` event (warn severity)
 *   2. insert a row into `handshakes` with metadata + completion flag.
 *
 * "Complete" handshake here = at least 4 EAPOL frames observed between the
 * same AP and STA. This is the minimum aircrack-ng needs to attempt cracking
 * (it really needs M1 + M2 with valid nonces, but in practice all 4 messages
 * being captured is the reliable indicator).
 */
export function eapolHandshake(db: Database, captureId: number): void {
  const rows = db
    .query<Row, [number]>(
      `SELECT frame_no, ts_rel, ta, ra, bssid, raw_json FROM packets
       WHERE capture_id=? AND raw_json LIKE '%"eapol"%' ORDER BY ts_rel`
    )
    .all(captureId);
  if (rows.length === 0) return;

  // Group by sorted MAC pair so AP/STA direction doesn't split into two groups.
  const byPair = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.ta || !r.ra) continue;
    const pair = [r.ta, r.ra].sort().join('|');
    const arr = byPair.get(pair) ?? [];
    arr.push(r);
    byPair.set(pair, arr);
  }

  const insertEvent = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'eapol_handshake', 'warn', ?, ?, ?, ?, ?)`
  );
  const insertHs = db.prepare(
    `INSERT OR REPLACE INTO handshakes
     (capture_id, ap_mac, sta_mac, bssid, ssid, frame_count, ts_rel_start, ts_rel_end, is_complete)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const [pair, arr] of byPair) {
    if (arr.length < 4) continue;
    const [a, b] = pair.split('|');

    // Decide AP vs STA. The AP is whichever of the two we saw transmitting
    // beacons (subtype=8) in this capture. Fall back to the BSSID field from
    // these frames if no beacons match.
    const beaconHit = db
      .query<{ ta: string | null }, [number, string]>(
        `SELECT ta FROM packets WHERE capture_id=? AND type=0 AND subtype=8 AND ta=? LIMIT 1`
      );
    const aIsAp = !!beaconHit.get(captureId, a);
    const bIsAp = !!beaconHit.get(captureId, b);

    let ap: string;
    let sta: string;
    if (aIsAp && !bIsAp) { ap = a; sta = b; }
    else if (bIsAp && !aIsAp) { ap = b; sta = a; }
    else {
      // Both or neither are APs. Use the bssid field from a frame in this pair.
      const bssidFromFrame = arr.find((r) => r.bssid)?.bssid ?? a;
      ap = bssidFromFrame === a ? a : b;
      sta = ap === a ? b : a;
    }
    const bssid = arr.find((r) => r.bssid)?.bssid ?? ap;

    // Resolve SSID from networks table.
    const ssidRow = db
      .query<{ ssid: string | null }, [number, string]>(
        `SELECT ssid FROM networks WHERE capture_id=? AND bssid=?`
      )
      .get(captureId, bssid);
    const ssid = ssidRow?.ssid ?? null;

    insertEvent.run(
      captureId,
      arr[0].ts_rel,
      arr[arr.length - 1].ts_rel,
      arr.length,
      JSON.stringify([ap, sta]),
      JSON.stringify({ ap, sta, bssid, ssid, frames: arr.length })
    );

    insertHs.run(
      captureId,
      ap,
      sta,
      bssid,
      ssid,
      arr.length,
      arr[0].ts_rel,
      arr[arr.length - 1].ts_rel,
      arr.length >= 4 ? 1 : 0
    );
  }
}
