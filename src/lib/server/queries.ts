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

// ---------- Global (cross-capture) aggregates ----------

export interface AggregatedNetwork {
  bssid: string;
  ssids: string[];           // distinct non-empty SSIDs ever advertised on this BSSID
  ssid: string | null;       // primary SSID for display (most-seen)
  vendor: string | null;
  encryption: string;        // "strongest" seen across captures
  channels: number[];
  countries: string[];
  beacon_total: number;
  client_total: number;      // max clients seen in any single capture (sum can over-count)
  captures: { id: number; filename: string }[];
}

const ENCRYPTION_RANK: Record<string, number> = {
  OPEN: 0, WEP: 1, WPA: 2, WPA2: 3, 'WPA2/WPA3': 4, WPA3: 5
};

export function listAllNetworksAggregated(): AggregatedNetwork[] {
  const rows = db
    .query<
      { capture_id: number; capture_filename: string; bssid: string; ssid: string | null;
        channel: number | null; encryption: string; vendor: string | null; country: string | null;
        beacon_count: number; client_count: number },
      []
    >(
      `SELECT n.capture_id, c.filename AS capture_filename, n.bssid, n.ssid, n.channel,
              n.encryption, n.vendor, n.country, n.beacon_count, n.client_count
       FROM networks n JOIN captures c ON c.id = n.capture_id`
    )
    .all();

  type Acc = {
    bssid: string;
    ssids: Map<string, number>; // ssid -> times seen (use beacon_count weight)
    channels: Set<number>;
    encryptions: Set<string>;
    countries: Set<string>;
    beacon_total: number;
    client_total: number;
    vendor: string | null;
    captures: Map<number, string>;
  };
  const m = new Map<string, Acc>();
  for (const r of rows) {
    let n = m.get(r.bssid);
    if (!n) m.set(r.bssid, (n = {
      bssid: r.bssid,
      ssids: new Map(),
      channels: new Set(),
      encryptions: new Set(),
      countries: new Set(),
      beacon_total: 0,
      client_total: 0,
      vendor: r.vendor,
      captures: new Map()
    }));
    if (r.ssid && r.ssid !== '') n.ssids.set(r.ssid, (n.ssids.get(r.ssid) ?? 0) + Math.max(1, r.beacon_count));
    if (r.channel) n.channels.add(r.channel);
    if (r.encryption) n.encryptions.add(r.encryption);
    if (r.country) n.countries.add(r.country);
    n.beacon_total += r.beacon_count;
    n.client_total = Math.max(n.client_total, r.client_count);
    n.captures.set(r.capture_id, r.capture_filename);
    if (!n.vendor && r.vendor) n.vendor = r.vendor;
  }

  return [...m.values()]
    .map((a) => {
      const ssidsByWeight = [...a.ssids.entries()].sort((x, y) => y[1] - x[1]);
      const encryption = [...a.encryptions]
        .sort((x, y) => (ENCRYPTION_RANK[y] ?? -1) - (ENCRYPTION_RANK[x] ?? -1))[0] ?? 'OPEN';
      return {
        bssid: a.bssid,
        ssids: ssidsByWeight.map(([s]) => s),
        ssid: ssidsByWeight[0]?.[0] ?? null,
        vendor: a.vendor,
        encryption,
        channels: [...a.channels].sort((x, y) => x - y),
        countries: [...a.countries],
        beacon_total: a.beacon_total,
        client_total: a.client_total,
        captures: [...a.captures.entries()].map(([id, filename]) => ({ id, filename }))
      };
    })
    .sort((a, b) => b.beacon_total - a.beacon_total);
}

export interface AggregatedDevice {
  mac: string;
  vendor: string | null;
  role: 'ap' | 'station';
  packets_tx: number;
  packets_rx: number;
  probed_ssids: string[];
  associated_bssids: string[];
  channels: number[];
  captures: { id: number; filename: string }[];
}

export function listAllDevicesAggregated(): AggregatedDevice[] {
  const rows = db
    .query<
      { capture_id: number; capture_filename: string; mac: string; vendor: string | null;
        role: string; packets_tx: number; packets_rx: number;
        probed_ssids_json: string; associated_bssids_json: string; channels_json: string },
      []
    >(
      `SELECT d.capture_id, c.filename AS capture_filename, d.mac, d.vendor, d.role,
              d.packets_tx, d.packets_rx, d.probed_ssids_json, d.associated_bssids_json, d.channels_json
       FROM devices d JOIN captures c ON c.id = d.capture_id`
    )
    .all();

  type Acc = {
    mac: string; vendor: string | null;
    sawAsAp: boolean;
    tx: number; rx: number;
    probed: Set<string>; assoc: Set<string>; channels: Set<number>;
    captures: Map<number, string>;
  };
  const m = new Map<string, Acc>();
  for (const r of rows) {
    let d = m.get(r.mac);
    if (!d) m.set(r.mac, (d = {
      mac: r.mac, vendor: r.vendor, sawAsAp: false,
      tx: 0, rx: 0,
      probed: new Set(), assoc: new Set(), channels: new Set(),
      captures: new Map()
    }));
    if (r.role === 'ap') d.sawAsAp = true;
    if (!d.vendor && r.vendor) d.vendor = r.vendor;
    d.tx += r.packets_tx;
    d.rx += r.packets_rx;
    try { (JSON.parse(r.probed_ssids_json) as string[]).forEach((s) => d!.probed.add(s)); } catch { /* skip */ }
    try { (JSON.parse(r.associated_bssids_json) as string[]).forEach((s) => d!.assoc.add(s)); } catch { /* skip */ }
    try { (JSON.parse(r.channels_json) as number[]).forEach((c) => d!.channels.add(c)); } catch { /* skip */ }
    d.captures.set(r.capture_id, r.capture_filename);
  }

  return [...m.values()]
    .map((a) => ({
      mac: a.mac,
      vendor: a.vendor,
      role: a.sawAsAp ? 'ap' as const : 'station' as const,
      packets_tx: a.tx,
      packets_rx: a.rx,
      probed_ssids: [...a.probed].sort(),
      associated_bssids: [...a.assoc].sort(),
      channels: [...a.channels].sort((x, y) => x - y),
      captures: [...a.captures.entries()].map(([id, filename]) => ({ id, filename }))
    }))
    .sort((a, b) => (b.packets_tx + b.packets_rx) - (a.packets_tx + a.packets_rx));
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
