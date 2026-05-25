import type { Database } from 'bun:sqlite';

interface BeaconRow { bssid: string; ssid: string | null; ts_rel: number; }
interface ProbeRespRow { bssid: string; ssid: string | null; ts_rel: number; }

export function hiddenSsid(db: Database, captureId: number): void {
  const beacons = db
    .query<BeaconRow, [number]>(
      `SELECT bssid, ssid, ts_rel FROM packets
       WHERE capture_id=? AND type=0 AND subtype=8 AND bssid IS NOT NULL`
    )
    .all(captureId);
  const probeResp = db
    .query<ProbeRespRow, [number]>(
      `SELECT bssid, ssid, ts_rel FROM packets
       WHERE capture_id=? AND type=0 AND subtype=5 AND bssid IS NOT NULL AND ssid IS NOT NULL AND ssid <> ''`
    )
    .all(captureId);

  const hiddenBssids = new Map<string, number>();
  for (const b of beacons) {
    if (b.ssid === null || b.ssid === '') {
      if (!hiddenBssids.has(b.bssid)) hiddenBssids.set(b.bssid, b.ts_rel);
    } else {
      hiddenBssids.delete(b.bssid);
    }
  }

  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'hidden_ssid', 'info', ?, ?, ?, ?, ?)`
  );

  for (const [bssid, firstSeen] of hiddenBssids) {
    const reveal = probeResp.find((r) => r.bssid === bssid && r.ssid && r.ssid !== '');
    if (!reveal) continue;
    insert.run(
      captureId, firstSeen, reveal.ts_rel, 1,
      JSON.stringify([bssid]),
      JSON.stringify({ bssid, revealed_ssid: reveal.ssid })
    );
  }
}
