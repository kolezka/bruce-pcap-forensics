import type { Database } from 'bun:sqlite';

interface Row { frame_no: number; ts_rel: number; ta: string | null; ra: string | null; }

const WINDOW_S = 30;
const THRESHOLD = 10;

/**
 * A flood of 802.11 authentication frames (type=0 subtype=11) from one STA
 * to one BSSID. Indicates either an unstable client reconnecting in a loop,
 * or a deliberate auth-flood DoS / brute force attempt. Severity warn.
 */
export function authFlood(db: Database, captureId: number): void {
  const rows = db
    .query<Row, [number]>(
      `SELECT frame_no, ts_rel, ta, ra FROM packets
       WHERE capture_id=? AND type=0 AND subtype=11
       ORDER BY ts_rel`
    )
    .all(captureId);

  // Group by (TA, RA) pair so we attribute the flood to the right station
  // hitting the right AP.
  const byPair = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.ta || !r.ra) continue;
    const key = `${r.ta}|${r.ra}`;
    const arr = byPair.get(key) ?? [];
    arr.push(r);
    byPair.set(key, arr);
  }

  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'auth_flood', 'warn', ?, ?, ?, ?, ?)`
  );

  for (const [key, arr] of byPair) {
    const [ta, ra] = key.split('|');
    let i = 0;
    while (i < arr.length) {
      let j = i;
      while (j + 1 < arr.length && arr[j + 1].ts_rel - arr[i].ts_rel <= WINDOW_S) j++;
      const n = j - i + 1;
      if (n >= THRESHOLD) {
        insert.run(
          captureId, arr[i].ts_rel, arr[j].ts_rel, n,
          JSON.stringify([ta, ra]),
          JSON.stringify({ sta: ta, ap: ra, count: n })
        );
        i = j + 1;
      } else { i++; }
    }
  }
}
