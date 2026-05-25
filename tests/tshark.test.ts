import { test, expect } from 'bun:test';
import { streamPackets, detectRadiotap } from '../src/lib/server/ingest/tshark';

test('streamPackets yields rows from raw.pcap', async () => {
  let count = 0;
  let first: any = null;
  for await (const row of streamPackets('tests/fixtures/raw.pcap')) {
    if (!first) first = row;
    count++;
  }
  expect(count).toBeGreaterThan(100);
  expect(first.layers.frame.frame_frame_number).toBe('1');
  expect(first.layers.wlan?.wlan_wlan_fc_type_subtype).toBeDefined();
});

test('detectRadiotap returns false for Bruce capture', async () => {
  expect(await detectRadiotap('tests/fixtures/raw.pcap')).toBe(false);
});
