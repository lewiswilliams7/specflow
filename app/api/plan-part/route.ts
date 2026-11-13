/**
 * M14: plan one form of a long brief. The browser calls this once per form, in parallel, then sends the sealed
 * results to /api/turns to be merged and saved, so no single request runs into the time limit. Never writes to Halo
 * and saves nothing.
 */
import { formRequest, splitForms } from '@/lib/specflow/forms';
import { partIsSealed, sealPart } from '@/lib/specflow/part-seal';
import type { Plan } from '@/lib/specflow/plan-types';
import { generatePlan, type Inventory } from '@/lib/specflow/planner';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const { supabase, user, workspace } = await getContext();
  const body = (await req.json().catch(() => ({}))) as { instance_id?: string; message?: string; index?: number; fix?: { plan: Plan; errors: string[]; seal: string } };
  const split = splitForms(String(body.message ?? '').slice(0, 120000));
  const i = Number(body.index);
  if (!split || !Number.isInteger(i) || i < 0 || i >= split.forms.length) return json(400, 'That part of the request wasn’t found.');
  const { data: inst } = await supabase.from('instances').select('id, inventory').eq('id', body.instance_id ?? '').eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  if (!inst.inventory) return json(400, 'Read the instance first, so the plan knows what already exists.');

  const title = split.forms[i].title;
  const request = formRequest(split, i);
  const opts = { signal: req.signal, cacheKey: `specflow-${inst.id}`, effort: 'low' as const, deadline: Date.now() + 280_000 };
  let result;
  if (body.fix) {
    // A part that came back with problems: one more pass on that part alone, as a revision of its own plan.
    if (!partIsSealed(inst.id, title, body.fix.plan ?? null, body.fix.seal)) return json(400, 'That part didn’t come from the planner. Send the message again.');
    const problems = (body.fix.errors ?? []).slice(0, 40).map((e) => `- ${e}`).join('\n');
    result = await generatePlan(
      inst.inventory as Inventory,
      `Fix only these problems in the plan for "${title}", and change nothing else:\n${problems}`,
      { requester: { email: user.email ?? '' }, previous: body.fix.plan, history: [{ role: 'user', text: request }] },
      opts,
    );
    // M12 can't apply here: this is always a fix of the same part.
    if (result.plan) delete result.plan.fresh;
  } else {
    // Transcribing a written form design: low reasoning keeps each part well inside the time limit.
    result = await generatePlan(inst.inventory as Inventory, request, { requester: { email: user.email ?? '' } }, opts);
  }
  return Response.json({ title, plan: result.plan, errors: result.errors, model: result.model, seal: sealPart(inst.id, title, result.plan) });
}
