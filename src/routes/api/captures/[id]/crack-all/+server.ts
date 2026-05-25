import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { startCrack } from '$lib/server/crack';
import type { HandshakeRow } from '$lib/types';

export const POST: RequestHandler = async ({ params, request }) => {
  const captureId = Number(params.id);
  const body = await request.json().catch(() => null);
  const wordlist = body?.wordlist;
  if (!wordlist || typeof wordlist !== 'string') throw error(400, 'wordlist required');

  const targets = db
    .query<HandshakeRow, [number]>(
      `SELECT * FROM handshakes WHERE capture_id=? AND is_complete=1 AND crack_status != 'cracked'`
    )
    .all(captureId);

  const started: number[] = [];
  for (const hs of targets) {
    try { await startCrack(hs.id, wordlist); started.push(hs.id); }
    catch (e) { console.error('[crack-all] failed for', hs.id, e); }
  }
  return json({ started, total: targets.length }, { status: 202 });
};
