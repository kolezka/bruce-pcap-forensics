import { test, expect } from 'bun:test';
import { ingestFile } from '../../src/lib/server/ingest';
import { openTestDb } from '../../src/lib/server/db';

test('deauth.pcap fires deauth_burst', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/deauth.pcap', 'upload');
  const ev = db.query<{ kind: string }, [number]>(`SELECT kind FROM events WHERE capture_id=?`).all(cap.id);
  expect(ev.some((e) => e.kind === 'deauth_burst')).toBe(true);
});

test('raw.pcap does NOT fire deauth_burst', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const ev = db.query<{ kind: string }, [number]>(`SELECT kind FROM events WHERE capture_id=?`).all(cap.id);
  expect(ev.some((e) => e.kind === 'deauth_burst')).toBe(false);
});
