import { test, expect } from 'bun:test';
import { ingestFile } from '../../src/lib/server/ingest';
import { openTestDb } from '../../src/lib/server/db';

test('karma events meet threshold and have mac in details', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const ev = db
    .query<{ kind: string; details_json: string }, [number]>(`SELECT kind, details_json FROM events WHERE capture_id=?`)
    .all(cap.id);
  for (const e of ev.filter((e) => e.kind === 'karma')) {
    const d = JSON.parse(e.details_json);
    expect(d.ssid_count).toBeGreaterThanOrEqual(20);
    expect(typeof d.mac).toBe('string');
  }
});
