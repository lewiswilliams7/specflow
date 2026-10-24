/**
 * The builder and plan checks are shared with the spike (halo-config-spike/spike/lib). This copies them in,
 * changing only import paths. `--check` fails if the app's copies have drifted.
 *   node scripts/sync-builder.mjs           copy from ../halo-config-spike
 *   node scripts/sync-builder.mjs --check   compare only
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const spike = join(app, '..', 'halo-config-spike', 'spike', 'lib');
const FILES = [
  ['runtime.ts', 'lib/specflow/build/runtime.ts'],
  ['clean.ts', 'lib/specflow/build/clean.ts'],
  ['translators.ts', 'lib/specflow/build/translators.ts'],
  ['discover.ts', 'lib/specflow/build/discover.ts'],
  ['build.ts', 'lib/specflow/build/build.ts'],
  ['plan-checks.ts', 'lib/specflow/plan-checks.ts'],
];
const toApp = (src, dest) =>
  src
    .replace(/from '\.\/translators\.js'/g, dest.endsWith('plan-checks.ts') ? "from './build/translators'" : "from './translators'")
    .replace(/from '\.\/([\w-]+)\.js'/g, "from './$1'")
    .replace("Keep identical to the app's lib/specflow/plan-checks.ts (only the import line differs).", "Keep identical to the spike's spike/lib/plan-checks.ts (only the import line differs).");

if (!existsSync(spike)) {
  console.log(`No spike checkout at ${spike}: skipped.`);
  process.exit(0);
}
const check = process.argv.includes('--check');
let drift = 0;
for (const [from, to] of FILES) {
  const want = toApp(readFileSync(join(spike, from), 'utf8'), to);
  const dest = join(app, to);
  const have = existsSync(dest) ? readFileSync(dest, 'utf8') : '';
  if (want === have) continue;
  if (check) { console.error(`Drift: ${to} differs from spike/lib/${from}`); drift++; }
  else { writeFileSync(dest, want); console.log(`Copied spike/lib/${from} → ${to}`); }
}
if (drift) process.exit(1);
console.log(check ? 'Builder files match the spike.' : 'Builder files in sync.');
