-- Editing a message replaces that turn and everything after it. The old turns are kept, marked superseded.
alter table public.plans add column if not exists superseded_at timestamptz;
drop index if exists plans_thread_idx;
create index if not exists plans_thread_live_idx on public.plans (thread_id, created_at) where superseded_at is null;
