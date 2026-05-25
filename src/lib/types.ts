export type CaptureStatus = 'pending' | 'parsing' | 'ready' | 'error';
export type CaptureSource = 'upload' | 'watch';
export type Encryption = 'OPEN' | 'WEP' | 'WPA' | 'WPA2' | 'WPA3' | 'WPA2/WPA3';
export type DeviceRole = 'ap' | 'station' | 'unknown';
export type EventKind = 'deauth_burst' | 'eapol_handshake' | 'karma' | 'hidden_ssid' | 'channel_hopping';
export type Severity = 'info' | 'warn' | 'high';

export interface CaptureRow {
  id: number;
  filename: string;
  sha256: string;
  bytes: number;
  uploaded_at: number;
  parsed_at: number | null;
  status: CaptureStatus;
  packet_count: number;
  first_ts_rel: number | null;
  last_ts_rel: number | null;
  has_radiotap: 0 | 1;
  error: string | null;
  source: CaptureSource;
  /** Real-world capture start (UTC ISO 8601) when the source has an RTC.
   *  NULL for Bruce captures — they have no RTC, so absolute time is meaningless. */
  started_at: string | null;
}

export interface PacketRow {
  id: number;
  capture_id: number;
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
  raw_json: string;
}

export interface NetworkRow {
  capture_id: number;
  bssid: string;
  ssid: string | null;
  channel: number | null;
  encryption: Encryption;
  vendor: string | null;
  country: string | null;
  beacon_count: number;
  client_count: number;
  first_seen: number;
  last_seen: number;
}

export interface DeviceRow {
  capture_id: number;
  mac: string;
  vendor: string | null;
  role: DeviceRole;
  packets_tx: number;
  packets_rx: number;
  first_seen: number;
  last_seen: number;
  probed_ssids_json: string;
  associated_bssids_json: string;
  channels_json: string;
}

export interface EventRow {
  id: number;
  capture_id: number;
  kind: EventKind;
  severity: Severity;
  ts_rel_start: number;
  ts_rel_end: number;
  count: number;
  actors_json: string;
  details_json: string;
}
