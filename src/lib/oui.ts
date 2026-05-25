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
