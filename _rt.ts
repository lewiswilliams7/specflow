import { haloReader } from './lib/specflow/halo';
import { readInventory } from './lib/specflow/inventory';
(async () => {
  const t = Date.now();
  const inv = await readInventory(haloReader({ baseUrl: 'http://localhost:4996', tenant: '', clientId: 'x', clientSecret: 'y' }));
  console.log('read ok after a 504:', Object.keys(inv.workflows_and_their_steps).length, 'workflows,', Math.round((Date.now() - t) / 1000), 's');
})().catch((e) => console.log('FAILED', e.message));
