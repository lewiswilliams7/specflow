/** Runs learning round 28 (lib/specflow/build/learn-areas.ts) on Lewis's trial and returns SEND-TO-CLAUDE-28.txt. */
import { isAdmin, isTrial } from '@/lib/admin';
import { decrypt } from '@/lib/crypto';
import { learnAreas } from '@/lib/specflow/build/learn-areas';
import { memoryTemplates, withRuntime } from '@/lib/specflow/build/runtime';
import { READ_ONLY_MESSAGE, assertPublicHost, haloClient } from '@/lib/specflow/halo';
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const { data: { user: signedIn } } = await auth.auth.getUser();
  if (!signedIn) return json(401, 'Your session has ended. Sign in again.');
  const { supabase, user, workspace } = await getContext();
  if (!isAdmin(user.email)) return json(404, 'Not found.');

  const body = (await req.json().catch(() => ({}))) as { instance_id?: string; apply?: boolean };
  const { data: inst } = await supabase.from('instances').select('id, base_url, tenant, client_id, secret_ciphertext').eq('id', body.instance_id ?? '').eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  if (!isTrial(inst.base_url)) return json(403, 'Learning rounds only run on your own trial, never a client instance.');
  try {
    await assertPublicHost(inst.base_url);
  } catch (e) {
    return json(400, (e as Error).message);
  }

  const halo = haloClient({ baseUrl: inst.base_url, tenant: inst.tenant ?? '', clientId: inst.client_id, clientSecret: decrypt(inst.secret_ciphertext) });
  const apply = body.apply === true;
  try {
    if (apply && (await halo.access()) === 'read:all') return json(403, READ_ONLY_MESSAGE);
    const { out, summary } = await withRuntime({ halo, templates: memoryTemplates() }, () => learnAreas({ apply, instance: inst.base_url }));
    return new Response(JSON.stringify({ ...out, summary }, null, 2), {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'content-disposition': 'attachment; filename="SEND-TO-CLAUDE-28.txt"', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return json(500, `The round stopped: ${(e as Error).message}`.slice(0, 500));
  }
}
