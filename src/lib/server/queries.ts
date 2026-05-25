import { db } from './db';
import type { CaptureRow, NetworkRow, DeviceRow, EventRow, PacketRow, HandshakeRow } from '../types';

export function listCaptures(): CaptureRow[] {
  return db.query<CaptureRow, []>(`SELECT * FROM captures ORDER BY uploaded_at DESC`).all();
}

export function getCapture(id: number): CaptureRow | null {
  return db.query<CaptureRow, [number]>(`SELECT * FROM captures WHERE id=?`).get(id) as CaptureRow | null;
}

export function listNetworks(captureId: number): NetworkRow[] {
  return db
    .query<NetworkRow, [number]>(
      `SELECT * FROM networks WHERE capture_id=? ORDER BY beacon_count DESC, last_seen DESC`
    )
    .all(captureId);
}

export function listDevices(captureId: number): DeviceRow[] {
  return db
    .query<DeviceRow, [number]>(
      `SELECT * FROM devices WHERE capture_id=? ORDER BY (packets_tx + packets_rx) DESC`
    )
    .all(captureId);
}

export function listHandshakes(captureId: number): HandshakeRow[] {
  return db
    .query<HandshakeRow, [number]>(`SELECT * FROM handshakes WHERE capture_id=? ORDER BY ts_rel_start ASC`)
    .all(captureId);
}

export function listEvents(captureId: number): EventRow[] {
  return db
    .query<EventRow, [number]>(`SELECT * FROM events WHERE capture_id=? ORDER BY ts_rel_start ASC`)
    .all(captureId);
}

export interface PacketFilter {
  type?: number; subtype?: number;
  bssid?: string; ta?: string; ra?: string;
  fromTs?: number; toTs?: number;
  limit?: number; offset?: number;
}

export function listPackets(captureId: number, f: PacketFilter = {}): PacketRow[] {
  const where: string[] = ['capture_id=?'];
  const args: (string | number)[] = [captureId];
  if (f.type !== undefined) { where.push('type=?'); args.push(f.type); }
  if (f.subtype !== undefined) { where.push('subtype=?'); args.push(f.subtype); }
  if (f.bssid) { where.push('bssid=?'); args.push(f.bssid); }
  if (f.ta) { where.push('ta=?'); args.push(f.ta); }
  if (f.ra) { where.push('ra=?'); args.push(f.ra); }
  if (f.fromTs !== undefined) { where.push('ts_rel>=?'); args.push(f.fromTs); }
  if (f.toTs !== undefined) { where.push('ts_rel<=?'); args.push(f.toTs); }
  const limit = Math.min(f.limit ?? 200, 1000);
  const offset = f.offset ?? 0;
  return db
    .query<PacketRow, (string | number)[]>(
      `SELECT * FROM packets WHERE ${where.join(' AND ')} ORDER BY frame_no ASC LIMIT ${limit} OFFSET ${offset}`
    )
    .all(...args);
}

export interface PacketHistoBin { ts_rel: number; count: number; type: number; subtype: number; }

export function packetsHistogram(captureId: number, bins: number = 80): PacketHistoBin[] {
  const cap = getCapture(captureId);
  if (!cap || cap.last_ts_rel == null || cap.first_ts_rel == null) return [];
  const span = Math.max(1e-6, cap.last_ts_rel - cap.first_ts_rel);
  const binSec = span / bins;
  return db
    .query<PacketHistoBin, [number, number, number, number]>(
      `SELECT (CAST((ts_rel - ?) / ? AS INTEGER) * ?) AS ts_rel, type, subtype, COUNT(*) AS count
       FROM packets WHERE capture_id=?
       GROUP BY 1, type, subtype ORDER BY 1`
    )
    .all(cap.first_ts_rel, binSec, binSec, captureId);
}
