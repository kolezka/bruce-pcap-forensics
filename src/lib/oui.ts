import data from './oui-data.json';
import { vendorOuiKey } from './format';

const MAP = data as Record<string, string>;

export function lookupVendor(mac: string | null | undefined): string | null {
  if (!mac) return null;
  return MAP[vendorOuiKey(mac)] ?? null;
}

export function isLocallyAdministered(mac: string): boolean {
  const first = parseInt(mac.slice(0, 2), 16);
  return (first & 0b10) !== 0;
}

/** Multicast / broadcast (the I/G bit — LSB of the first octet). Covers
 *  ff:ff:ff:ff:ff:ff, 01:00:5e:*, 33:33:*, 01:80:c2:*. These are not
 *  endpoint devices, they are destination groups. */
export function isMulticast(mac: string): boolean {
  const first = parseInt(mac.slice(0, 2), 16);
  return (first & 0b1) === 1;
}
