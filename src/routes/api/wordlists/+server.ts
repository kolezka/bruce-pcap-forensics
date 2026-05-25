import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { listWordlists } from '$lib/server/crack';

export const GET: RequestHandler = async () => json(await listWordlists());
