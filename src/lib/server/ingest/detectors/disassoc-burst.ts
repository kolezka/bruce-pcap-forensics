import type { Database } from 'bun:sqlite';

interface Row { frame_no: number; ts_rel: number; ta: string | null; ra: string | null; reason_code: number | null; }

const WINDOW_S = 60;
const THRESHOLD = 3;

/**
 * Similar to deauth burst but for disassociation frames (subtype 10).
 * Disassoc has slightly different semantics — the AP can still tell the STA
 * it is no longer associated, even if PMF is enabled in some configs — so
 * we surface it separately from deauth.
 */
export function disassocBurst(db: Database, captureId: number): void {
  const rows = db
    .query<Row, [number]>(
      `SELECT frame_no, ts_rel, ta, ra, reason_code FROM packets
       WHERE capture_id=? AND type=0 AND subtype=10
       ORDER BY ts_rel`
    )
    .all(captureId);

  const byTa = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.ta) continue;
    const arr = byTa.get(r.ta) ?? [];
    arr.push(r);
    byTa.set(r.ta, arr);
  }

  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'disassoc_burst', 'high', ?, ?, ?, ?, ?)`
  );

  for (const [ta, arr] of byTa) {
    let i = 0;
    while (i < arr.length) {
      let j = i;
      while (j + 1 < arr.length && arr[j + 1].ts_rel - arr[i].ts_rel <= WINDOW_S) j++;
      const n = j - i + 1;
      if (n >= THRESHOLD) {
        const slice = arr.slice(i, j + 1);
        const targets = new Set(slice.map((r) => r.ra).filter(Boolean) as string[]);
        const reasons = new Set(slice.map((r) => r.reason_code).filter((x) => x !== null) as number[]);
        insert.run(
          captureId, arr[i].ts_rel, arr[j].ts_rel, n,
          JSON.stringify([ta, ...targets]),
          JSON.stringify({ attacker: ta, targets: [...targets], reasons: [...reasons] })
        );
        i = j + 1;
      } else { i++; }
    }
  }
}
