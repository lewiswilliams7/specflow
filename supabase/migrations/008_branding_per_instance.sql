-- Branding belongs to the client, not the workspace: a partner's workspace holds several clients' instances, each
-- with its own logo and colour. Moves the (still empty) columns from 006 to instances. Logos stay in brand-logos,
-- under the workspace's folder.

alter table public.instances
  add column if not exists brand_name text,
  add column if not exists brand_colour text check (brand_colour is null or brand_colour ~* '^#[0-9a-f]{6}$'),
  add column if not exists brand_logo_url text check (brand_logo_url is null or brand_logo_url like 'https://%'),
  add column if not exists brand_footer text check (brand_footer is null or char_length(brand_footer) <= 300);

alter table public.workspaces
  drop column if exists brand_name,
  drop column if exists brand_colour,
  drop column if exists brand_logo_url,
  drop column if exists brand_footer;

-- 006's column grant still stops members changing their own plan: only the name is theirs to edit.
revoke update on public.workspaces from authenticated, anon;
grant update (name) on public.workspaces to authenticated;
