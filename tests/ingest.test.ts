import { test, expect } from 'bun:test';
import { ingestFile } from '../src/lib/server/ingest';
import { openTestDb } from '../src/lib/server/db';

test('ingestFile parses raw.pcap end-to-end', async () => {
  const db = openTestDb();
  const result = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  expect(result.status).toBe('ready');
  expect(result.packet_count).toBeGreaterThan(100);
});

test('ingestFile is idempotent on identical sha256', async () => {
  const db = openTestDb();
  const a = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const b = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  expect(b.id).toBe(a.id);
  const c = (db.query<{ c: number }, []>(`SELECT count(*) c FROM captures`).get() as { c: number }).c;
  expect(c).toBe(1);
});
