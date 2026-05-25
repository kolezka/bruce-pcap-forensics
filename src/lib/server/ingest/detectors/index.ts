import type { Database } from 'bun:sqlite';
import { deauthBurst } from './deauth-burst';
import { disassocBurst } from './disassoc-burst';
import { authFlood } from './auth-flood';
import { eapolHandshake } from './eapol-handshake';
import { karma } from './karma';
import { hiddenSsid } from './hidden-ssid';
import { channelHopping } from './channel-hopping';
import { wpsEnabled } from './wps-enabled';
import { evilTwin } from './evil-twin';
import { weakCrypto } from './weak-crypto';
import { pmfDisabled } from './pmf-disabled';

export function runDetectors(db: Database, captureId: number): void {
  deauthBurst(db, captureId);
  disassocBurst(db, captureId);
  authFlood(db, captureId);
  eapolHandshake(db, captureId);
  karma(db, captureId);
  hiddenSsid(db, captureId);
  channelHopping(db, captureId);
  wpsEnabled(db, captureId);
  evilTwin(db, captureId);
  weakCrypto(db, captureId);
  pmfDisabled(db, captureId);
}
