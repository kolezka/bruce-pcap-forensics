import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getCapture } from '$lib/server/queries';
import { join, basename } from 'node:path';

const CAPTURES_DIR = process.env.PCAP_CAPTURES_DIR ?? 'captures';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const c = getCapture(id);
  if (!c) throw error(404);
  const safe = basename(c.filename);
  const path = join(CAPTURES_DIR, safe);
  const file = Bun.file(path);
  if (!(await file.exists())) throw error(404, 'pcap missing on disk');
  return new Response(file, {
    headers: {
      'content-type': 'application/vnd.tcpdump.pcap',
      'content-disposition': `attachment; filename="${safe}"`,
      'content-length': String(file.size)
    }
  });
};
