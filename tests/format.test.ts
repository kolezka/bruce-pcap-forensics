import { test, expect } from 'bun:test';
import { canonicalMac, decodeTsharkSsid, formatDuration } from '../src/lib/format';

test('canonicalMac lowercases and validates', () => {
  expect(canonicalMac('94:3C:96:4C:1D:D4')).toBe('94:3c:96:4c:1d:d4');
  expect(canonicalMac('FF-FF-FF-FF-FF-FF')).toBe('ff:ff:ff:ff:ff:ff');
  expect(canonicalMac(null)).toBe(null);
  expect(canonicalMac('not a mac')).toBe(null);
});

test('decodeTsharkSsid converts colon-hex to utf8', () => {
  expect(decodeTsharkSsid('4f:72:61:6e:67:65:5f:53:77:69:61:74:6c:6f:77:6f:64:5f:31:44:44:30')).toBe(
    'Orange_Swiatlowod_1DD0'
  );
  expect(decodeTsharkSsid('')).toBe('');
  expect(decodeTsharkSsid(null)).toBe(null);
});

test('formatDuration renders mm:ss.fff', () => {
  expect(formatDuration(0)).toBe('00:00.000');
  expect(formatDuration(65.432)).toBe('01:05.432');
  expect(formatDuration(3725.5)).toBe('62:05.500');
});
