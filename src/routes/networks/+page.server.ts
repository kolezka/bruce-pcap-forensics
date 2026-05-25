import type { PageServerLoad } from './$types';
import { listAllNetworksAggregated } from '$lib/server/queries';

export const load: PageServerLoad = async () => ({
  networks: listAllNetworksAggregated()
});
