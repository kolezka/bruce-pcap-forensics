import type { PageServerLoad } from './$types';
import { listAllDevicesAggregated } from '$lib/server/queries';

export const load: PageServerLoad = async () => ({
  devices: listAllDevicesAggregated()
});
