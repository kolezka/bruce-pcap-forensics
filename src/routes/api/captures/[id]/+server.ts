import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getCapture, listNetworks, listDevices, listEvents, listHandshakes } from '$lib/server/queries';
import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const capture = getCapture(id);
  if (!capture) throw error(404, 'not found');
  return json({
    capture,
    networks: listNetworks(id),
    devices: listDevices(id),
    events: listEvents(id),
    handshakes: listHandshakes(id)
  });
};

export const DELETE: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const c = getCapture(id);
  if (!c) throw error(404);
  db.run(`DELETE FROM captures WHERE id=?`, [id]);
  try { await unlink(join(CAPTURES_DIR, c.filename)); } catch { /* may be gone */ }
  return new Response(null, { status: 204 });
};
