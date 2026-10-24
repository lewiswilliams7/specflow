-- Builds: every preview and apply of a plan against Halo, with each step's outcome. The audit trail.
create table if not exists public.builds (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instance_id uuid not null references public.instances (id) on delete cascade,
  plan_id uuid references public.plans (id) on delete set null,
  thread_id uuid references public.threads (id) on delete set null,
  mode text not null check (mode in ('preview', 'apply')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed', 'refused', 'stopped')),
  summary jsonb,
  log jsonb not null default '[]'::jsonb,
  lines jsonb not null default '[]'::jsonb,
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists builds_plan_idx on public.builds (plan_id, started_at desc);
create index if not exists builds_instance_idx on public.builds (instance_id, started_at desc);
-- One apply at a time per instance.
create unique index if not exists builds_one_apply_running on public.builds (instance_id) where status = 'running' and mode = 'apply';

alter table public.builds enable row level security;
drop policy if exists "members manage builds" on public.builds;
create policy "members manage builds" on public.builds for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
