import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { genSsidList } from '$lib/server/wordlistJobs';

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => null)) as { ssid?: string } | null;
  const ssid = body?.ssid;
  if (!ssid || typeof ssid !== 'string') throw error(400, 'ssid required');
  try {
    const r = await genSsidList(ssid);
    return json(r, { status: 201 });
  } catch (e) {
    throw error(400, String((e as Error).message ?? e));
  }
};
