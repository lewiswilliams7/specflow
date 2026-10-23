-- Pilot applications from the landing page form (app/api/pilot).
-- Written only by the server with the service role key; no public access.
create table if not exists public.pilot_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  company text not null,
  email text not null,
  builds text,
  notes text
);

alter table public.pilot_applications enable row level security;
-- No policies: anon and authenticated users can't read or write. The service role bypasses RLS.
