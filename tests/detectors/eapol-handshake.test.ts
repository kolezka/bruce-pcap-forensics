import { test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { ingestFile } from '../../src/lib/server/ingest';
import { openTestDb } from '../../src/lib/server/db';

test('raw.pcap does not fire eapol_handshake', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const ev = db.query<{ kind: string }, [number]>(`SELECT kind FROM events WHERE capture_id=?`).all(cap.id);
  expect(ev.some((e) => e.kind === 'eapol_handshake')).toBe(false);
});

test.skipIf(!existsSync('tests/fixtures/handshake.pcap'))(
  'handshake.pcap fires eapol_handshake',
  async () => {
    const db = openTestDb();
    const cap = await ingestFile(db, 'tests/fixtures/handshake.pcap', 'upload');
    const ev = db.query<{ kind: string }, [number]>(`SELECT kind FROM events WHERE capture_id=?`).all(cap.id);
    expect(ev.some((e) => e.kind === 'eapol_handshake')).toBe(true);
  }
);
