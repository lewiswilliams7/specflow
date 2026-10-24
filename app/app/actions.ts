'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decrypt, encrypt } from '@/lib/crypto';
import { assertPublicHost, haloReader, normaliseBaseUrl } from '@/lib/specflow/halo';
import { readInventory } from '@/lib/specflow/inventory';
import type { Plan } from '@/lib/specflow/plan-types';
import { generatePlan, type Inventory } from '@/lib/specflow/planner';
import { getContext } from '@/lib/workspace';

export type FormState = { error?: string; ok?: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

/** Connect a Halo instance: check the address is a public host, sign in to Halo, store the secret encrypted. */
export async function connectInstance(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user, workspace, limits } = await getContext();
  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const clientId = String(form.get('client_id') ?? '').trim();
  const clientSecret = String(form.get('client_secret') ?? '').trim();
  const tenant = String(form.get('tenant') ?? '').trim();
  let baseUrl: string;
  try {
    baseUrl = normaliseBaseUrl(String(form.get('base_url') ?? ''));
  } catch {
    return { error: 'Enter your Halo address, for example yourco.haloitsm.com.' };
  }
  if (!name || !clientId || !clientSecret) return { error: 'Fill in a name, the client ID and the client secret.' };

  const { count } = await supabase.from('instances').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id);
  if (limits.instances !== null && (count ?? 0) >= limits.instances) {
    return { error: `Your plan includes ${limits.instances} Halo instance${limits.instances === 1 ? '' : 's'}. Disconnect one first, or upgrade when paid plans open.` };
  }

  try {
    await assertPublicHost(baseUrl);
    await haloReader({ baseUrl, tenant, clientId, clientSecret }).token();
  } catch (e) {
    return { error: msg(e) };
  }

  const { data, error } = await supabase
    .from('instances')
    .insert({
      workspace_id: workspace.id,
      name,
      base_url: baseUrl,
      tenant,
      client_id: clientId,
      secret_ciphertext: encrypt(clientSecret),
      status: 'connected',
      last_checked_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error || !data) return { error: 'Connected to Halo, but saving failed. Try again.' };
  revalidatePath('/app');
  redirect(`/app/instances/${data.id}?connected=1`);
}

async function loadInstance(id: string) {
  const ctx = await getContext();
  const { data: inst } = await ctx.supabase.from('instances').select('*').eq('id', id).eq('workspace_id', ctx.workspace.id).single();
  if (!inst) throw new Error('That instance isn’t in your workspace.');
  const reader = haloReader({ baseUrl: inst.base_url, tenant: inst.tenant, clientId: inst.client_id, clientSecret: decrypt(inst.secret_ciphertext) });
  return { ...ctx, inst, reader };
}

/** Read the instance's configuration (names and settings). Read-only; takes a minute or two on a big instance. */
export async function scanInstance(_: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('instance_id') ?? '');
  try {
    const { supabase, inst, reader } = await loadInstance(id);
    await assertPublicHost(inst.base_url);
    const inventory = await readInventory(reader);
    await supabase
      .from('instances')
      .update({ inventory, inventory_at: new Date().toISOString(), status: 'connected', last_error: null, last_checked_at: new Date().toISOString() })
      .eq('id', id);
    revalidatePath(`/app/instances/${id}`);
    return { ok: `Read ${inventory.ticket_types.length} ticket types, ${inventory.custom_fields.length} custom fields and ${Object.keys(inventory.workflows_and_their_steps).length} workflows.` };
  } catch (e) {
    return { error: msg(e) };
  }
}

/** What the planner did on an earlier turn, as a short note for the conversation history. */
function plannerNote(plan: Plan | null, errors: string[]): string {
  if (!plan) return `No usable plan (${errors[0] ?? 'unknown problem'}).`;
  const changes = plan.steps.filter((s) => s.action !== 'reuse').map((s) => `${s.action} ${s.object} "${s.name ?? s.match?.name}"`);
  return [
    changes.length ? `Planned ${changes.length} change(s): ${changes.join('; ')}.` : 'Planned no changes.',
    plan.unsupported?.length ? `Couldn't do: ${plan.unsupported.join(' | ')}.` : '',
    plan.questions?.length ? `Asked: ${plan.questions.join(' | ')}` : '',
  ].filter(Boolean).join(' ');
}

/** One turn: plan the message (with the conversation so far) and save it. Never writes to Halo. */
async function planTurn(instanceId: string, message: string, threadId?: string): Promise<{ threadId?: string; error?: string }> {
  const { supabase, user, workspace, limits, inst } = await loadInstance(instanceId);
  if (!inst.inventory) return { error: 'Read the instance first, so the plan knows what already exists.' };
  if (limits.plansPerMonth !== null) {
    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase.from('plans').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).gte('created_at', since.toISOString());
    if ((count ?? 0) >= limits.plansPerMonth) return { error: `You’ve used this month’s ${limits.plansPerMonth} plans on Explore.` };
  }

  let history: { role: 'user' | 'planner'; text: string }[] = [];
  let previous: Plan | null = null;
  if (threadId) {
    const { data: turns } = await supabase.from('plans').select('message, request, plan, errors').eq('thread_id', threadId).order('created_at');
    for (const t of turns ?? []) {
      history.push({ role: 'user', text: t.message ?? t.request });
      history.push({ role: 'planner', text: plannerNote(t.plan as Plan | null, (t.errors as string[]) ?? []) });
    }
    previous = ((turns ?? []).at(-1)?.plan as Plan | null) ?? null;
  } else {
    const { data: thread, error } = await supabase
      .from('threads')
      .insert({ workspace_id: workspace.id, instance_id: instanceId, title: message.slice(0, 90), created_by: user.id })
      .select('id')
      .single();
    if (error || !thread) return { error: 'Couldn’t start the conversation. Try again.' };
    threadId = thread.id;
  }

  const result = await generatePlan(inst.inventory as Inventory, message, {
    requester: { email: user.email ?? '' },
    history,
    previous,
  });
  const { error } = await supabase.from('plans').insert({
    workspace_id: workspace.id,
    instance_id: instanceId,
    thread_id: threadId,
    message,
    request: result.plan?.request ?? message,
    plan: result.plan,
    errors: result.errors,
    model: result.model,
    created_by: user.id,
  });
  if (error) return { error: 'The plan was made but couldn’t be saved. Try again.' };
  await supabase.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
  return { threadId };
}

/** Start a conversation from the instance page. */
export async function startThread(_: FormState, form: FormData): Promise<FormState> {
  const instanceId = String(form.get('instance_id') ?? '');
  const message = String(form.get('message') ?? '').trim().slice(0, 8000);
  if (message.length < 20) return { error: 'Describe what you need in a sentence or two.' };
  let threadId: string | undefined;
  try {
    const r = await planTurn(instanceId, message);
    if (r.error) return { error: r.error };
    threadId = r.threadId;
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/app/threads/${threadId}`);
}

/** Reply in a conversation: answers, corrections, "make it optional instead"... re-plans with everything so far. */
export async function replyThread(_: FormState, form: FormData): Promise<FormState> {
  const threadId = String(form.get('thread_id') ?? '');
  const message = String(form.get('message') ?? '').trim().slice(0, 8000);
  if (!message) return { error: 'Write a reply first.' };
  try {
    const { supabase, workspace } = await getContext();
    const { data: thread } = await supabase.from('threads').select('instance_id').eq('id', threadId).eq('workspace_id', workspace.id).single();
    if (!thread) return { error: 'That conversation isn’t in your workspace.' };
    const r = await planTurn(thread.instance_id, message, threadId);
    if (r.error) return { error: r.error };
  } catch (e) {
    return { error: msg(e) };
  }
  revalidatePath(`/app/threads/${threadId}`);
  return { ok: 'Planned.' };
}
