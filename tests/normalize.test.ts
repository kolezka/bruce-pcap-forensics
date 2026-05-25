import { test, expect } from 'bun:test';
import { normalize } from '../src/lib/server/ingest/normalize';
import { streamPackets } from '../src/lib/server/ingest/tshark';

test('normalize labels beacons and extracts ssid/channel', async () => {
  for await (const row of streamPackets('tests/fixtures/raw.pcap')) {
    const p = normalize(row);
    if (p.type_name === 'beacon') {
      expect(p.bssid).toMatch(/^[0-9a-f:]{17}$/);
      expect(typeof p.ssid).toBe('string');
      expect(typeof p.channel).toBe('number');
      return;
    }
  }
  throw new Error('no beacon found');
});

test('normalize labels deauth and extracts reason_code', async () => {
  for await (const row of streamPackets('tests/fixtures/deauth.pcap')) {
    const p = normalize(row);
    expect(p.type_name).toBe('deauthentication');
    expect(p.reason_code).toBe(3);
    return;
  }
});

test('normalize lowercases MACs', async () => {
  for await (const row of streamPackets('tests/fixtures/raw.pcap')) {
    const p = normalize(row);
    if (p.ta) expect(p.ta).toBe(p.ta.toLowerCase());
    return;
  }
});
