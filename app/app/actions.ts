'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decrypt, encrypt } from '@/lib/crypto';
import { assertPublicHost, haloReader, normaliseBaseUrl } from '@/lib/specflow/halo';
import { readInventory } from '@/lib/specflow/inventory';
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

/** Plan a request against the last scan. Never writes to Halo. */
export async function createPlan(_: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('instance_id') ?? '');
  const request = String(form.get('request') ?? '').trim().slice(0, 8000);
  if (request.length < 20) return { error: 'Describe what you need in a sentence or two.' };
  let planId: string | undefined;
  try {
    const { supabase, user, workspace, limits, inst } = await loadInstance(id);
    if (!inst.inventory) return { error: 'Read the instance first, so the plan knows what already exists.' };
    if (limits.plansPerMonth !== null) {
      const since = new Date();
      since.setUTCDate(1);
      since.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase.from('plans').select('id', { count: 'exact', head: true }).eq('workspace_id', workspace.id).gte('created_at', since.toISOString());
      if ((count ?? 0) >= limits.plansPerMonth) return { error: `You’ve used this month’s ${limits.plansPerMonth} plans on Explore.` };
    }
    const result = await generatePlan(inst.inventory as Inventory, request);
    const { data, error } = await supabase
      .from('plans')
      .insert({ workspace_id: workspace.id, instance_id: id, request, plan: result.plan, errors: result.errors, model: result.model, created_by: user.id })
      .select('id')
      .single();
    if (error || !data) return { error: 'The plan was made but couldn’t be saved. Try again.' };
    planId = data.id;
  } catch (e) {
    return { error: msg(e) };
  }
  redirect(`/app/plans/${planId}`);
}
