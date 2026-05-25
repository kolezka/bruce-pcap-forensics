import type { Database } from 'bun:sqlite';
import { basename } from 'node:path';
import { detectRadiotap, streamPackets } from './tshark';
import { normalize, type NormalizedPacket } from './normalize';
import { aggregate } from './aggregate';
import { runDetectors } from './detectors';
import type { CaptureRow, CaptureSource } from '../../types';

async function sha256OfFile(path: string): Promise<string> {
  const buf = await Bun.file(path).arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function ingestFile(
  db: Database,
  filePath: string,
  source: CaptureSource
): Promise<CaptureRow> {
  const filename = basename(filePath);
  const file = Bun.file(filePath);
  const bytes = file.size;
  const [hash, hasRadiotap] = await Promise.all([
    sha256OfFile(filePath),
    detectRadiotap(filePath).catch(() => false)
  ]);

  const existing = db
    .query<CaptureRow, [string]>(`SELECT * FROM captures WHERE sha256 = ?`)
    .get(hash) as CaptureRow | null;
  if (existing) return existing;

  const insert = db.run(
    `INSERT INTO captures (filename, sha256, bytes, uploaded_at, status, has_radiotap, source)
     VALUES (?, ?, ?, ?, 'parsing', ?, ?)`,
    [filename, hash, bytes, Date.now(), hasRadiotap ? 1 : 0, source]
  );
  const id = Number(insert.lastInsertRowid);

  const insertPacket = db.prepare(
    `INSERT INTO packets (capture_id, frame_no, ts_rel, type, subtype, type_name, ta, ra, sa, da, bssid, ssid, channel, reason_code, length, retry, protected, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  let firstTs: number | null = null;
  let lastTs = 0;

  try {
    const BATCH = 1000;
    let batch: NormalizedPacket[] = [];
    const flush = db.transaction((rows: NormalizedPacket[]) => {
      for (const p of rows) {
        insertPacket.run(
          id,
          p.frame_no,
          p.ts_rel,
          p.type,
          p.subtype,
          p.type_name,
          p.ta,
          p.ra,
          p.sa,
          p.da,
          p.bssid,
          p.ssid,
          p.channel,
          p.reason_code,
          p.length,
          p.retry,
          p.protected,
          JSON.stringify(p.raw_extras)
        );
      }
    });

    // Captures with an RTC (Wireshark / aircrack on a real host) put a real
    // Unix epoch in frame.frame_time_epoch. Bruce has no RTC so its first
    // frame starts a few seconds after Jan 1 1970. We sniff the first frame's
    // epoch and only keep it if it's after 2010-01-01 (sanity threshold).
    const Y2010 = Date.parse('2010-01-01T00:00:00Z');
    let startedAt: string | null = null;

    for await (const row of streamPackets(filePath)) {
      const p = normalize(row);
      if (firstTs === null) {
        firstTs = p.ts_rel;
        const epoch = row.layers.frame?.frame_frame_time_epoch as string | undefined;
        if (epoch) {
          const t = Date.parse(epoch);
          if (Number.isFinite(t) && t >= Y2010) startedAt = new Date(t).toISOString();
        }
      }
      lastTs = p.ts_rel;
      batch.push(p);
      count++;
      if (batch.length >= BATCH) { flush(batch); batch = []; }
    }
    if (batch.length) flush(batch);

    aggregate(db, id);
    runDetectors(db, id);

    db.run(
      `UPDATE captures SET status='ready', parsed_at=?, packet_count=?, first_ts_rel=?, last_ts_rel=?, started_at=? WHERE id=?`,
      [Date.now(), count, firstTs ?? 0, lastTs, startedAt, id]
    );
  } catch (e) {
    db.run(`UPDATE captures SET status='error', error=? WHERE id=?`, [String(e).slice(0, 1000), id]);
    throw e;
  }

  return db.query<CaptureRow, [number]>(`SELECT * FROM captures WHERE id=?`).get(id) as CaptureRow;
}

export async function reparse(db: Database, captureId: number, filePath: string): Promise<CaptureRow> {
  db.run(`DELETE FROM captures WHERE id=?`, [captureId]);
  return ingestFile(db, filePath, 'upload');
}
