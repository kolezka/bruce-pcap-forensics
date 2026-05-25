import { test, expect } from 'bun:test';
import { ingestFile } from '../src/lib/server/ingest';
import { openTestDb } from '../src/lib/server/db';

test('networks include the Sagemcom AP from raw.pcap', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const sagemcom = db
    .query<{ bssid: string; ssid: string | null; vendor: string | null; encryption: string }, [number, string]>(
      `SELECT bssid, ssid, vendor, encryption FROM networks WHERE capture_id=? AND bssid=?`
    )
    .get(cap.id, '94:3c:96:4c:1d:d4') as any;
  expect(sagemcom).toBeTruthy();
  expect(sagemcom.vendor).toMatch(/Sagemcom/i);
  expect(sagemcom.ssid).toBe('Orange_Swiatlowod_1DD0');
  expect(['WPA2', 'WPA3', 'WPA2/WPA3']).toContain(sagemcom.encryption);
});

test('devices classify the AP role correctly', async () => {
  const db = openTestDb();
  const cap = await ingestFile(db, 'tests/fixtures/raw.pcap', 'upload');
  const ap = db
    .query<{ role: string }, [number, string]>(`SELECT role FROM devices WHERE capture_id=? AND mac=?`)
    .get(cap.id, '94:3c:96:4c:1d:d4') as { role: string };
  expect(ap.role).toBe('ap');
});
