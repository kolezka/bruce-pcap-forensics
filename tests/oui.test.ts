import { test, expect } from 'bun:test';
import { lookupVendor, isLocallyAdministered } from '../src/lib/oui';

test('lookupVendor finds Sagemcom for the AP MAC in raw.pcap', () => {
  expect(lookupVendor('94:3c:96:4c:1d:d4')).toMatch(/Sagemcom/i);
});

test('isLocallyAdministered detects randomized MAC', () => {
  expect(isLocallyAdministered('0a:e8:e4:7d:cc:fe')).toBe(true);
  expect(isLocallyAdministered('94:3c:96:4c:1d:d4')).toBe(false);
});
