import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getHandshake } from '$lib/server/crack';

export const GET: RequestHandler = async ({ params }) => {
  const id = Number(params.id);
  const hs = getHandshake(id);
  if (!hs) throw error(404, 'handshake not found');
  return json(hs);
};
