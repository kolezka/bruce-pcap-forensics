import { test, expect } from 'bun:test';
import { openTestDb } from '../src/lib/server/db';
import { ingestFile } from '../src/lib/server/ingest';

test('full pipeline: raw.pcap → networks + devices populated', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  expect(cap.status).toBe('ready');
  expect(cap.packet_count).toBeGreaterThan(100);
  const nets = db.query<{ c: number }, [number]>(`SELECT count(*) c FROM networks WHERE capture_id=?`).get(cap.id) as { c: number };
  const devs = db.query<{ c: number }, [number]>(`SELECT count(*) c FROM devices WHERE capture_id=?`).get(cap.id) as { c: number };
  expect(nets.c).toBeGreaterThan(0);
  expect(devs.c).toBeGreaterThan(0);
});

test('full pipeline: deauth.pcap → deauth_burst event present', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/deauth.pcap', 'upload');
  const evs = db.query<{ kind: string }, [number]>(`SELECT kind FROM events WHERE capture_id=?`).all(cap.id);
  expect(evs.some((e) => e.kind === 'deauth_burst')).toBe(true);
});
