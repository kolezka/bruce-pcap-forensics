import type { PageServerLoad } from './$types';
import { listCaptures } from '$lib/server/queries';

export const load: PageServerLoad = async () => ({ captures: listCaptures() });
