/**
 * M14: plan one form of a long brief. The browser calls this once per form, in parallel, then sends the sealed
 * results to /api/turns to be merged and saved, so no single request runs into the time limit. Never writes to Halo
 * and saves nothing.
 */
import { formRequest, splitForms } from '@/lib/specflow/forms';
import { sealPart } from '@/lib/specflow/part-seal';
import { generatePlan, type Inventory } from '@/lib/specflow/planner';
import { getContext } from '@/lib/workspace';

export const preferredRegion = 'lhr1';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const json = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const { supabase, user, workspace } = await getContext();
  const body = (await req.json().catch(() => ({}))) as { instance_id?: string; message?: string; index?: number };
  const split = splitForms(String(body.message ?? '').slice(0, 120000));
  const i = Number(body.index);
  if (!split || !Number.isInteger(i) || i < 0 || i >= split.forms.length) return json(400, 'That part of the request wasn’t found.');
  const { data: inst } = await supabase.from('instances').select('id, inventory').eq('id', body.instance_id ?? '').eq('workspace_id', workspace.id).single();
  if (!inst) return json(404, 'That instance isn’t in your workspace.');
  if (!inst.inventory) return json(400, 'Read the instance first, so the plan knows what already exists.');

  // Transcribing a written form design: low reasoning keeps each part well inside the time limit.
  const result = await generatePlan(inst.inventory as Inventory, formRequest(split, i), { requester: { email: user.email ?? '' } }, { signal: req.signal, cacheKey: `specflow-${inst.id}`, effort: 'low' });
  const title = split.forms[i].title;
  return Response.json({ title, plan: result.plan, errors: result.errors, model: result.model, seal: sealPart(inst.id, title, result.plan) });
}
