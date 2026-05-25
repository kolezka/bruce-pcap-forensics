import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { listPackets, packetsHistogram } from '$lib/server/queries';

export const GET: RequestHandler = async ({ params, url }) => {
  const id = Number(params.id);
  if (url.searchParams.get('histogram') === '1') return json(packetsHistogram(id));
  const f = {
    type: url.searchParams.has('type') ? Number(url.searchParams.get('type')) : undefined,
    subtype: url.searchParams.has('subtype') ? Number(url.searchParams.get('subtype')) : undefined,
    bssid: url.searchParams.get('bssid') ?? undefined,
    ta: url.searchParams.get('ta') ?? undefined,
    ra: url.searchParams.get('ra') ?? undefined,
    fromTs: url.searchParams.has('from') ? Number(url.searchParams.get('from')) : undefined,
    toTs: url.searchParams.has('to') ? Number(url.searchParams.get('to')) : undefined,
    limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 200,
    offset: url.searchParams.has('offset') ? Number(url.searchParams.get('offset')) : 0
  };
  return json(listPackets(id, f));
};
