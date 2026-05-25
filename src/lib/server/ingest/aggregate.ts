import type { Database } from 'bun:sqlite';
import { lookupVendor, isMulticast } from '../../oui';
import type { Encryption, DeviceRole } from '../../types';

interface PacketLite {
  frame_no: number; ts_rel: number;
  type: number; subtype: number;
  ta: string | null; ra: string | null; sa: string | null; da: string | null;
  bssid: string | null; ssid: string | null; channel: number | null;
  raw_json: string;
}

function deriveEncryption(extras: Record<string, unknown>): Encryption {
  const hasRsn = extras.rsn === true;
  const hasWpa = extras.wpa === true;
  const privacy = extras.privacy === true;
  if (hasRsn) {
    // RSN AKM 8/12/13 = SAE (WPA3). Both AKMs (e.g. "1027074,1027080") → mixed WPA2/WPA3.
    const akmsField = extras.rsn_akms;
    const akmStr = String(akmsField ?? '');
    const akms = akmStr.split(',').map((s) => Number(s.trim()) & 0xff);
    const hasSae = akms.some((a) => a === 8 || a === 12 || a === 13);
    const hasPsk = akms.some((a) => a === 2 || a === 6);
    if (hasSae && hasPsk) return 'WPA2/WPA3';
    if (hasSae) return 'WPA3';
    return 'WPA2';
  }
  if (hasWpa) return 'WPA';
  if (privacy) return 'WEP';
  return 'OPEN';
}

const BROADCAST = 'ff:ff:ff:ff:ff:ff';
const NULLMAC = '00:00:00:00:00:00';

export function aggregate(db: Database, captureId: number): void {
  const pkts = db
    .query<PacketLite, [number]>(
      `SELECT frame_no, ts_rel, type, subtype, ta, ra, sa, da, bssid, ssid, channel, raw_json
       FROM packets WHERE capture_id=? ORDER BY frame_no`
    )
    .all(captureId);

  const nets = new Map<string, {
    ssid: string | null; channel: number | null; country: string | null;
    beacon_count: number; first_seen: number; last_seen: number;
    encExtras: Record<string, unknown>; clients: Set<string>;
  }>();

  const devs = new Map<string, {
    tx: number; rx: number; first: number; last: number;
    probed: Set<string>; assoc: Set<string>; channels: Set<number>;
    sawAsBssidBeacons: number;
  }>();

  const touchDev = (mac: string | null, ts: number) => {
    if (!mac || isMulticast(mac)) return null;
    let d = devs.get(mac);
    if (!d) devs.set(mac, (d = {
      tx: 0, rx: 0, first: ts, last: ts,
      probed: new Set(), assoc: new Set(), channels: new Set(),
      sawAsBssidBeacons: 0
    }));
    d.first = Math.min(d.first, ts);
    d.last = Math.max(d.last, ts);
    return d;
  };

  for (const p of pkts) {
    let extras: Record<string, unknown> = {};
    try { extras = JSON.parse(p.raw_json); } catch { /* skip */ }

    const txDev = touchDev(p.ta, p.ts_rel); if (txDev) txDev.tx++;
    const rxDev = touchDev(p.ra, p.ts_rel); if (rxDev) rxDev.rx++;
    touchDev(p.sa, p.ts_rel);
    touchDev(p.da, p.ts_rel);

    if (p.bssid && p.bssid !== BROADCAST && p.bssid !== NULLMAC) {
      let n = nets.get(p.bssid);
      if (!n) nets.set(p.bssid, (n = {
        ssid: null, channel: null,
        country: (extras.country as string | undefined) ?? null,
        beacon_count: 0, first_seen: p.ts_rel, last_seen: p.ts_rel,
        encExtras: {}, clients: new Set()
      }));
      n.first_seen = Math.min(n.first_seen, p.ts_rel);
      n.last_seen = Math.max(n.last_seen, p.ts_rel);
      if (p.ssid && p.ssid.length > 0 && !n.ssid) n.ssid = p.ssid;
      if (p.channel && !n.channel) n.channel = p.channel;
      if ((extras.country as string | undefined) && !n.country) n.country = extras.country as string;
      for (const k of ['rsn', 'wpa', 'privacy', 'rsn_akms'] as const) {
        if (extras[k] !== undefined && n.encExtras[k] === undefined) n.encExtras[k] = extras[k];
      }
      if (p.type === 0 && p.subtype === 8) {
        n.beacon_count++;
        const d = devs.get(p.bssid); if (d) d.sawAsBssidBeacons++;
      }
      for (const mac of [p.ta, p.ra, p.sa, p.da]) {
        if (mac && mac !== p.bssid && !isMulticast(mac) && mac !== NULLMAC) {
          n.clients.add(mac);
          // Keep devices.associated_bssids consistent with networks.clients —
          // any device that touched a BSSID in any role gets it in its assoc set.
          devs.get(mac)?.assoc.add(p.bssid);
        }
      }
    }

    if (p.type === 0 && p.subtype === 4 && p.ssid && p.ta) devs.get(p.ta)?.probed.add(p.ssid);
    if (p.channel && p.ta) devs.get(p.ta)?.channels.add(p.channel);
  }

  const insertN = db.prepare(
    `INSERT OR REPLACE INTO networks
     (capture_id, bssid, ssid, channel, encryption, vendor, country, beacon_count, client_count, first_seen, last_seen)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertD = db.prepare(
    `INSERT OR REPLACE INTO devices
     (capture_id, mac, vendor, role, packets_tx, packets_rx, first_seen, last_seen, probed_ssids_json, associated_bssids_json, channels_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  );

  db.transaction(() => {
    for (const [bssid, n] of nets) {
      insertN.run(
        captureId, bssid, n.ssid, n.channel,
        deriveEncryption(n.encExtras),
        lookupVendor(bssid),
        n.country, n.beacon_count, n.clients.size, n.first_seen, n.last_seen
      );
    }
    for (const [mac, d] of devs) {
      const role: DeviceRole = d.sawAsBssidBeacons > 0 ? 'ap' : 'station';
      insertD.run(
        captureId, mac, lookupVendor(mac), role,
        d.tx, d.rx, d.first, d.last,
        JSON.stringify([...d.probed]),
        JSON.stringify([...d.assoc]),
        JSON.stringify([...d.channels])
      );
    }
  })();
}
