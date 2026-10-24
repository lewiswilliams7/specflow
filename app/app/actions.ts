'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decrypt, encrypt } from '@/lib/crypto';
import { assertPublicHost, HaloAuthError, haloClient, normaliseBaseUrl } from '@/lib/specflow/halo';
import { readInventory } from '@/lib/specflow/inventory';
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
    await haloClient({ baseUrl, tenant, clientId, clientSecret }).token();
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
  const reader = haloClient({ baseUrl: inst.base_url, tenant: inst.tenant, clientId: inst.client_id, clientSecret: decrypt(inst.secret_ciphertext) });
  return { ...ctx, inst, reader };
}

/** When Halo refuses the saved login, say so on the instance so every page can point to the fix. */
async function noteFailure(id: string, e: unknown) {
  if (!(e instanceof HaloAuthError)) return;
  const { supabase, workspace } = await getContext();
  await supabase.from('instances').update({ status: 'failed', last_error: e.message, last_checked_at: new Date().toISOString() }).eq('id', id).eq('workspace_id', workspace.id);
  revalidatePath('/app', 'layout');
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
    await noteFailure(id, e);
    return { error: msg(e) };
  }
}

/**
 * Update a connection: name, address, client ID, secret (blank keeps the saved one) and tenant.
 * The new login is tested against Halo before anything is saved.
 */
export async function updateConnection(_: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('instance_id') ?? '');
  const { supabase, workspace } = await getContext();
  const { data: inst } = await supabase.from('instances').select('*').eq('id', id).eq('workspace_id', workspace.id).single();
  if (!inst) return { error: 'That instance isn’t in your workspace.' };

  const name = String(form.get('name') ?? '').trim().slice(0, 80);
  const clientId = String(form.get('client_id') ?? '').trim();
  const newSecret = String(form.get('client_secret') ?? '').trim();
  const tenant = String(form.get('tenant') ?? '').trim();
  let baseUrl: string;
  try {
    baseUrl = normaliseBaseUrl(String(form.get('base_url') ?? ''));
  } catch {
    return { error: 'Enter your Halo address, for example yourco.haloitsm.com.' };
  }
  if (!name || !clientId) return { error: 'Fill in a name and the client ID.' };
  const clientSecret = newSecret || decrypt(inst.secret_ciphertext);

  try {
    await assertPublicHost(baseUrl);
    await haloClient({ baseUrl, tenant, clientId, clientSecret }).token();
  } catch (e) {
    return { error: msg(e) };
  }

  // A different address is a different Halo: what was read from the old one no longer applies.
  const moved = baseUrl !== inst.base_url;
  const { error } = await supabase
    .from('instances')
    .update({
      name,
      base_url: baseUrl,
      tenant,
      client_id: clientId,
      ...(newSecret ? { secret_ciphertext: encrypt(newSecret) } : {}),
      ...(moved ? { inventory: null, inventory_at: null } : {}),
      status: 'connected',
      last_error: null,
      last_checked_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) return { error: 'Halo accepted the login, but saving failed. Try again.' };
  revalidatePath('/app', 'layout');
  return { ok: moved ? 'Connected to the new address. Read its configuration before planning.' : 'Saved. Halo accepted the login.' };
}

/** Remove an instance from Specflow (never from Halo). Its conversations and build history go with it. */
export async function removeInstance(_: FormState, form: FormData): Promise<FormState> {
  const id = String(form.get('instance_id') ?? '');
  const typed = String(form.get('confirm') ?? '').trim();
  const { supabase, workspace } = await getContext();
  const { data: inst } = await supabase.from('instances').select('id, name').eq('id', id).eq('workspace_id', workspace.id).single();
  if (!inst) return { error: 'That instance isn’t in your workspace.' };
  if (typed !== inst.name) return { error: `Type ${inst.name} exactly to confirm.` };
  const { error } = await supabase.from('instances').delete().eq('id', id);
  if (error) return { error: 'Couldn’t remove it. Try again.' };
  revalidatePath('/app', 'layout');
  redirect('/app/instances?removed=1');
}
