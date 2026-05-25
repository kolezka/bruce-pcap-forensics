import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { db } from '$lib/server/db';
import { listCaptures } from '$lib/server/queries';
import { ingestFile } from '$lib/server/ingest';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';

export const GET: RequestHandler = async () => json(listCaptures());

export const POST: RequestHandler = async ({ request }) => {
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) throw error(400, 'missing file');
  if (!file.name.toLowerCase().match(/\.pcap(ng)?$/)) throw error(415, 'expected .pcap');

  await mkdir(CAPTURES_DIR, { recursive: true });
  const dest = join(CAPTURES_DIR, file.name);
  await Bun.write(dest, file);

  const cap = await ingestFile(db, dest, 'upload');
  return json(cap, { status: 201 });
};
