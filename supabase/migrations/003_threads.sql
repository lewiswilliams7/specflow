-- Conversations: a thread per piece of work; each user message produces a plan (a turn).
create table if not exists public.threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  title text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists threads_workspace_updated_idx on public.threads (workspace_id, updated_at desc);

alter table public.plans add column if not exists thread_id uuid references public.threads (id) on delete cascade;
alter table public.plans add column if not exists message text;
create index if not exists plans_thread_idx on public.plans (thread_id, created_at);

alter table public.threads enable row level security;
drop policy if exists "members manage threads" on public.threads;
create policy "members manage threads" on public.threads for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
