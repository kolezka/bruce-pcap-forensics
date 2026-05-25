import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getCapture } from '$lib/server/queries';
import { reparse } from '$lib/server/ingest';
import { join } from 'node:path';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';

export const POST: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const c = getCapture(id);
  if (!c) throw error(404);
  const cap = await reparse(db, id, join(CAPTURES_DIR, c.filename));
  return json(cap);
};
