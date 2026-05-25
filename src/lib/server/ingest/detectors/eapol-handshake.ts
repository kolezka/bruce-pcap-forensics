import type { Database } from 'bun:sqlite';

interface Row { frame_no: number; ts_rel: number; ta: string | null; ra: string | null; raw_json: string; }

export function eapolHandshake(db: Database, captureId: number): void {
  const rows = db
    .query<Row, [number]>(
      `SELECT frame_no, ts_rel, ta, ra, raw_json FROM packets
       WHERE capture_id=? AND raw_json LIKE '%"eapol"%' ORDER BY ts_rel`
    )
    .all(captureId);
  if (rows.length === 0) return;

  const byPair = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.ta || !r.ra) continue;
    const pair = [r.ta, r.ra].sort().join('|');
    const arr = byPair.get(pair) ?? [];
    arr.push(r);
    byPair.set(pair, arr);
  }

  const insert = db.prepare(
    `INSERT INTO events (capture_id, kind, severity, ts_rel_start, ts_rel_end, count, actors_json, details_json)
     VALUES (?, 'eapol_handshake', 'warn', ?, ?, ?, ?, ?)`
  );

  for (const [pair, arr] of byPair) {
    if (arr.length < 4) continue;
    insert.run(
      captureId, arr[0].ts_rel, arr[arr.length - 1].ts_rel, arr.length,
      JSON.stringify(pair.split('|')),
      JSON.stringify({ pair: pair.split('|'), frames: arr.length })
    );
  }
}
