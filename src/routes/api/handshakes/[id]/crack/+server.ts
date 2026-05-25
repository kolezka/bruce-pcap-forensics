import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { startCrack, getHandshake } from '$lib/server/crack';

export const POST: RequestHandler = async ({ params, request }) => {
  const id = Number(params.id);
  const body = await request.json().catch(() => null);
  const wordlist = body?.wordlist;
  if (!wordlist || typeof wordlist !== 'string') throw error(400, 'wordlist required');
  try {
    await startCrack(id, wordlist);
  } catch (e) {
    throw error(400, String((e as Error).message ?? e));
  }
  const hs = getHandshake(id);
  return json(hs, { status: 202 });
};
