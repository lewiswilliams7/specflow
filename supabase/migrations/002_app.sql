-- App: workspaces (a team), members, connected Halo instances, generated plans.
-- Row level security: a signed-in user only ever sees rows of workspaces they belong to.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'explore' check (plan in ('explore', 'solo', 'team', 'partner')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  base_url text not null,            -- e.g. https://yourco.haloitsm.com
  tenant text not null default '',
  client_id text not null,
  secret_ciphertext text not null,   -- AES-256-GCM, key only on the server (APP_ENCRYPTION_KEY)
  status text not null default 'untested' check (status in ('untested', 'connected', 'failed')),
  last_error text,
  last_checked_at timestamptz,
  inventory jsonb,                   -- last read of the instance's configuration
  inventory_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  request text not null,
  plan jsonb,
  errors jsonb not null default '[]'::jsonb,
  model text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists instances_workspace_idx on public.instances (workspace_id);
create index if not exists plans_workspace_created_idx on public.plans (workspace_id, created_at desc);

-- Membership check used by every policy (security definer avoids recursive RLS on workspace_members).
-- Lives in a schema the REST API doesn't expose, so it can't be called directly (Supabase advisor 0028/0029).
create schema if not exists private;
grant usage on schema private to authenticated;
create or replace function private.is_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant execute on function private.is_member(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.instances enable row level security;
alter table public.plans enable row level security;

drop policy if exists "members read workspace" on public.workspaces;
create policy "members read workspace" on public.workspaces for select to authenticated using (private.is_member(id));
drop policy if exists "members rename workspace" on public.workspaces;
create policy "members rename workspace" on public.workspaces for update to authenticated using (private.is_member(id)) with check (private.is_member(id));

drop policy if exists "members read members" on public.workspace_members;
create policy "members read members" on public.workspace_members for select to authenticated using (private.is_member(workspace_id));

drop policy if exists "members manage instances" on public.instances;
create policy "members manage instances" on public.instances for all to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));

drop policy if exists "members manage plans" on public.plans;
create policy "members manage plans" on public.plans for all to authenticated using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));

-- Every new account gets its own workspace, as owner, on the free Explore plan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare ws uuid;
begin
  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(new.raw_user_meta_data ->> 'workspace', ''), split_part(new.email, '@', 1) || '''s workspace'), new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;
