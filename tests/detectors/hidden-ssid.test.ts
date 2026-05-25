import { test, expect } from 'bun:test';
import { ingestFile } from '../../src/lib/server/ingest';
import { openTestDb } from '../../src/lib/server/db';

test('hidden_ssid events have a revealed_ssid in details', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const ev = db
    .query<{ kind: string; details_json: string }, [number]>(`SELECT kind, details_json FROM events WHERE capture_id=?`)
    .all(cap.id);
  for (const e of ev.filter((e) => e.kind === 'hidden_ssid')) {
    const d = JSON.parse(e.details_json);
    expect(typeof d.revealed_ssid).toBe('string');
    expect(d.revealed_ssid.length).toBeGreaterThan(0);
  }
});
