import { encrypt, decrypt } from './lib/crypto';
import { haloReader, normaliseBaseUrl, assertPublicHost } from './lib/specflow/halo';
import { readInventory } from './lib/specflow/inventory';
import { makePlanner } from './lib/specflow/planner';
import { readFileSync } from 'node:fs';
(async () => {

process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const c = encrypt('k-secret-value'); console.log('crypto round trip:', decrypt(c) === 'k-secret-value', c.slice(0, 8));
console.log('normalise:', normaliseBaseUrl('acme.haloitsm.com/api/foo'), normaliseBaseUrl('http://Acme.HaloITSM.com'));
for (const bad of ['https://localhost', 'https://10.0.0.5', 'https://192.168.1.1', 'http://acme.haloitsm.com', 'https://intranet']) {
  try { await assertPublicHost(bad); console.log('NOT blocked', bad); } catch (e) { console.log('blocked', bad, '-', (e as Error).message.slice(0, 60)); }
}
const reader = haloReader({ baseUrl: 'http://localhost:4996', tenant: '', clientId: 'x', clientSecret: 'y' });
const inv = await readInventory(reader);
console.log('inventory:', inv.ticket_types.length, 'ticket types,', Object.keys(inv.details!.ticket_types).length, 'with details');
const fake = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { validate } = makePlanner(inv, 'test');
console.log('validator on the first G5 plan:', validate(fake).slice(0, 4));

})();
