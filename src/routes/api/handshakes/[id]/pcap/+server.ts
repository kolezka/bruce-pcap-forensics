import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getHandshake } from '$lib/server/crack';
import { db } from '$lib/server/db';
import { join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { unlink } from 'node:fs/promises';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const hs = getHandshake(id);
  if (!hs) throw error(404, 'handshake not found');

  const cap = db
    .query<{ filename: string }, [number]>(`SELECT filename FROM captures WHERE id=?`)
    .get(hs.capture_id) as { filename: string } | null;
  if (!cap) throw error(404, 'capture not found');

  const src = join(CAPTURES_DIR, basename(cap.filename));
  if (!(await Bun.file(src).exists())) throw error(404, 'pcap missing on disk');

  const out = join(tmpdir(), `hs-${id}-${Date.now()}.pcap`);
  const filter = `(wlan.addr == ${hs.ap_mac} && wlan.addr == ${hs.sta_mac}) || (wlan.bssid == ${hs.bssid} && wlan.fc.type_subtype == 0x0008) || eapol`;

  const proc = Bun.spawn(['tshark', '-r', src, '-Y', filter, '-w', out], {
    stdout: 'pipe', stderr: 'pipe'
  });
  const code = await proc.exited;
  if (code !== 0) {
    try { await unlink(out); } catch { /* skip */ }
    const errText = await new Response(proc.stderr).text();
    throw error(500, 'tshark export failed: ' + errText.slice(0, 200));
  }

  const file = Bun.file(out);
  const bytes = await file.bytes();
  try { await unlink(out); } catch { /* skip */ }

  const fname = `handshake-${hs.ssid ?? hs.bssid.replace(/:/g, '')}.pcap`;
  return new Response(bytes, {
    headers: {
      'content-type': 'application/vnd.tcpdump.pcap',
      'content-disposition': `attachment; filename="${fname}"`,
      'content-length': String(bytes.length)
    }
  });
};
