import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getCapture, listNetworks, listDevices, listEvents, listHandshakes } from '$lib/server/queries';

export const load: PageServerLoad = async ({ params }) => {
  const id = Number(params.id);
  const capture = getCapture(id);
  if (!capture) throw error(404, 'capture not found');
  return {
    capture,
    networks: listNetworks(id),
    devices: listDevices(id),
    events: listEvents(id),
    handshakes: listHandshakes(id)
  };
};
