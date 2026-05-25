import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { getFetchState, startFetch } from '$lib/server/wordlistJobs';

export const GET: RequestHandler = async () => json(getFetchState());

export const POST: RequestHandler = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as {
    force?: boolean;
    includeCrackstation?: boolean;
    crunchBig?: boolean;
  };
  try {
    startFetch({
      force: !!body.force,
      includeCrackstation: !!body.includeCrackstation,
      crunchBig: !!body.crunchBig,
    });
  } catch (e) {
    throw error(409, String((e as Error).message ?? e));
  }
  return json(getFetchState(), { status: 202 });
};
