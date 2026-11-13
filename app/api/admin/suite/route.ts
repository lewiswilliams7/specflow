/**
 * Founder-only run-through (13 Nov): plans, previews and optionally builds the briefs in lib/suite.ts on the founder's
 * trial, one step per request so none runs into the time limit. The browser drives it (components/SuitePanel.tsx).
 * Trial hosts only, like the learning rounds. Building writes "zz S<tag>" objects on the trial and never deletes.
 */
import { isAdmin, isTrial } from '@/lib/admin';
import { decrypt } from '@/lib/crypto';
import { buildWithGate } from '@/lib/specflow/build/build';
import { memoryTemplates, withRuntime } from '@/lib/specflow/build/runtime';
import { READ_ONLY_MESSAGE, assertPublicHost, haloClient } from '@/lib/specflow/halo';
import { readInventory } from '@/lib/specflow/inventory';
import type { Plan } from '@/lib/specflow/plan-types';
import { generatePlan, mergeAndCheck, type Inventory } from '@/lib/specflow/planner';
import { SUITE, tagBrief } from '@/lib/suite';
import { supabaseServer } from '@/lib/supabase/server';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const json = (status: number, error: string) => Response.json({ error }, { status });

type Body = {
  op?: 'plan' | 'merge' | 'build' | 'refresh';
  instance_id?: string;
  index?: number;
  /** A brief pasted in the panel (kept in the founder's browser, never in this public repo). */
  brief_text?: string;
  tag?: string;
  parts?: { title: string; plan: Plan | null; errors: string[] }[];
  plan?: Plan;
  apply?: boolean;
};

export async function POST(req: Request) {
  const auth = await supabaseServer();
  const { data: { user: signedIn } } = await auth.auth.getUser();
  if (!signedIn) return json(401, 'Your session has ended. Sign in again.');
  const { supabase, user, workspace } = await getContext();
  if (!isAdmin(user.email)) return json(404, 'Not found.');

  const body = (await req.json().catch(() => ({}))) as Body;
  const { data: inst } = await supabase.from('instances').select('id, base_url, tenant, client_id, secret_ciphertext, inventory').eq('id', body.instance_id ?? '').eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  if (!isTrial(inst.base_url)) return json(403, 'The run-through only runs on your own trial, never a client instance.');
  try {
    await assertPublicHost(inst.base_url);
  } catch (e) {
    return json(400, (e as Error).message);
  }
  const halo = haloClient({ baseUrl: inst.base_url, tenant: inst.tenant ?? '', clientId: inst.client_id, clientSecret: decrypt(inst.secret_ciphertext) });
  const text = body.brief_text ? String(body.brief_text).slice(0, 120000) : SUITE[Number(body.index)]?.brief;
  const brief = text ? { brief: text } : null;
  const request = brief ? tagBrief(brief.brief, String(body.tag ?? 'x').replace(/[^A-Za-z0-9]/g, '').slice(0, 8)) : '';
  const opts = { signal: req.signal, cacheKey: `specflow-${inst.id}`, deadline: Date.now() + 280_000 };
  const ctx = { requester: { email: user.email ?? '' } };

  try {
    if (body.op === 'refresh') {
      const inventory = await readInventory(halo);
      await supabase.from('instances').update({ inventory, inventory_at: new Date().toISOString() }).eq('id', inst.id);
      return Response.json({ ok: true });
    }
    if (body.op === 'plan' || body.op === 'merge') {
      if (!brief) return json(400, 'No such brief.');
      if (!inst.inventory) return json(400, 'Read the instance first.');
      const t0 = Date.now();
      const result = body.op === 'merge'
        ? await mergeAndCheck(inst.inventory as Inventory, request, body.parts ?? [], ctx, opts)
        : await generatePlan(inst.inventory as Inventory, request, ctx, opts);
      return Response.json({ ...result, request, seconds: Math.round((Date.now() - t0) / 1000) });
    }
    if (body.op === 'build') {
      if (!body.plan) return json(400, 'No plan.');
      const apply = body.apply === true;
      if (apply && (await halo.access()) === 'read:all') return json(403, READ_ONLY_MESSAGE);
      // Stop between steps before the time limit; the browser runs it again and finished steps are reused.
      const stop = new AbortController();
      const budget = setTimeout(() => stop.abort(), 250_000);
      const t0 = Date.now();
      const result = await withRuntime({ halo, templates: memoryTemplates() }, () => buildWithGate(body.plan!, { apply, signal: stop.signal, emit: () => undefined }));
      clearTimeout(budget);
      return Response.json({
        ok: result.ok,
        refused: result.refused ?? false,
        stopped: result.stopped ?? false,
        problems: result.problems,
        log: result.log.map((l) => ({ step: l.step, object: l.object, name: l.name, outcome: l.outcome, id: l.id, detail: l.detail, error: l.error, warnings: l.warnings })),
        seconds: Math.round((Date.now() - t0) / 1000),
      });
    }
    return json(400, 'Unknown step.');
  } catch (e) {
    return json(500, `Stopped: ${(e as Error).message}`.slice(0, 600));
  }
}
