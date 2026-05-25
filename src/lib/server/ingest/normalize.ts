import { canonicalMac, decodeTsharkSsid } from '../../format';
import type { TsharkRow } from './tshark';

export interface NormalizedPacket {
  frame_no: number;
  ts_rel: number;
  type: number;
  subtype: number;
  type_name: string;
  ta: string | null;
  ra: string | null;
  sa: string | null;
  da: string | null;
  bssid: string | null;
  ssid: string | null;
  channel: number | null;
  reason_code: number | null;
  length: number;
  retry: 0 | 1;
  protected: 0 | 1;
  raw_extras: Record<string, unknown>;
}

const NAME: Record<string, string> = {
  '0:0': 'association_request',
  '0:1': 'association_response',
  '0:2': 'reassociation_request',
  '0:3': 'reassociation_response',
  '0:4': 'probe_request',
  '0:5': 'probe_response',
  '0:8': 'beacon',
  '0:9': 'atim',
  '0:10': 'disassociation',
  '0:11': 'authentication',
  '0:12': 'deauthentication',
  '0:13': 'action',
  '1:11': 'rts',
  '1:12': 'cts',
  '1:13': 'ack',
  '1:9': 'block_ack',
  '2:0': 'data',
  '2:4': 'null_function',
  '2:8': 'qos_data',
  '2:12': 'qos_null'
};

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseInt(v, v.startsWith('0x') ? 16 : 10) : (v as number);
  return Number.isFinite(n) ? n : null;
}

function bool01(v: unknown): 0 | 1 {
  return v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0;
}

export function normalize(row: TsharkRow): NormalizedPacket {
  const f = row.layers.frame ?? {};
  const w = row.layers.wlan ?? {};
  const m = row.layers.wlan_wlan_mgt ?? {};

  const type = num(w.wlan_wlan_fc_type) ?? 0;
  const subtype = num(w.wlan_wlan_fc_subtype) ?? 0;
  const type_name = NAME[`${type}:${subtype}`] ?? `t${type}s${subtype}`;

  const ta = canonicalMac(w.wlan_wlan_ta as string | undefined);
  const ra = canonicalMac(w.wlan_wlan_ra as string | undefined);
  const sa = canonicalMac(w.wlan_wlan_sa as string | undefined);
  const da = canonicalMac(w.wlan_wlan_da as string | undefined);
  const bssid = canonicalMac(w.wlan_wlan_bssid as string | undefined);

  const ssidHex = (m.wlan_wlan_ssid as string | undefined) ?? null;
  const ssid = ssidHex !== null ? decodeTsharkSsid(ssidHex) : null;
  const channel = num(m.wlan_wlan_ds_current_channel ?? m.wlan_wlan_ht_info_primarychannel);

  const reason_code =
    type === 0 && (subtype === 12 || subtype === 10)
      ? num(
          (m as any).wlan_wlan_fixed_reason_code ??
            (row.layers as any).wlan_fixed?.wlan_fixed_reason_code
        )
      : null;

  const raw_extras: Record<string, unknown> = {};
  if (m.wlan_wlan_country_info_code) raw_extras.country = m.wlan_wlan_country_info_code;
  if (m.wlan_wlan_rsn_version !== undefined) raw_extras.rsn = true;
  if (m.wlan_wlan_wfa_ie_type) raw_extras.wpa = true;
  if (w.wlan_wlan_fc_protected !== undefined) raw_extras.fc_protected = w.wlan_wlan_fc_protected;
  if (m.wlan_wlan_fixed_capabilities_privacy) raw_extras.privacy = true;
  if (m.wlan_wlan_rsn_akms !== undefined) raw_extras.rsn_akms = m.wlan_wlan_rsn_akms;
  // Protected Management Frames (PMF) capability bits from RSN. Capturing
  // these lets us detect networks where deauth attacks still work (mfpc=0).
  if (m.wlan_wlan_rsn_capabilities_mfpc !== undefined) raw_extras.rsn_mfpc = !!m.wlan_wlan_rsn_capabilities_mfpc;
  if (m.wlan_wlan_rsn_capabilities_mfpr !== undefined) raw_extras.rsn_mfpr = !!m.wlan_wlan_rsn_capabilities_mfpr;
  // WPS presence — any wps_* field in management layer means the beacon /
  // probe response advertises Wi-Fi Protected Setup (Pixie Dust target).
  for (const k of Object.keys(m)) { if (k.startsWith('wps_')) { raw_extras.wps = true; break; } }
  if (row.layers.eapol) raw_extras.eapol = row.layers.eapol;

  return {
    frame_no: num(f.frame_frame_number) ?? 0,
    ts_rel: Number(f.frame_frame_time_relative ?? 0),
    type,
    subtype,
    type_name,
    ta,
    ra,
    sa,
    da,
    bssid,
    ssid,
    channel,
    reason_code,
    length: num(f.frame_frame_len) ?? 0,
    retry: bool01(w.wlan_wlan_fc_retry),
    protected: bool01(w.wlan_wlan_fc_protected),
    raw_extras
  };
}
