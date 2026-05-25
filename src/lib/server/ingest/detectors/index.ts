import type { Database } from 'bun:sqlite';
import { deauthBurst } from './deauth-burst';
import { eapolHandshake } from './eapol-handshake';
import { karma } from './karma';
import { hiddenSsid } from './hidden-ssid';
import { channelHopping } from './channel-hopping';
import { wpsEnabled } from './wps-enabled';
import { evilTwin } from './evil-twin';
import { weakCrypto } from './weak-crypto';

export function runDetectors(db: Database, captureId: number): void {
  deauthBurst(db, captureId);
  eapolHandshake(db, captureId);
  karma(db, captureId);
  hiddenSsid(db, captureId);
  channelHopping(db, captureId);
  wpsEnabled(db, captureId);
  evilTwin(db, captureId);
  weakCrypto(db, captureId);
}
