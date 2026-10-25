-- Workspace branding for the emails Enact builds (rule EM1) and the sign-off reports.
-- Also closes a gap: members could update every column of their workspace, including `plan`. Now they can only
-- change the name and the branding; the plan changes only through the server (service role).

alter table public.workspaces
  add column if not exists brand_name text,
  add column if not exists brand_colour text check (brand_colour is null or brand_colour ~* '^#[0-9a-f]{6}$'),
  add column if not exists brand_logo_url text check (brand_logo_url is null or brand_logo_url like 'https://%'),
  add column if not exists brand_footer text check (brand_footer is null or char_length(brand_footer) <= 300);

revoke update on public.workspaces from authenticated, anon;
grant update (name, brand_name, brand_colour, brand_logo_url, brand_footer) on public.workspaces to authenticated;

-- Logos: public to read (email clients fetch them), only a workspace's members can write under its folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-logos', 'brand-logos', true, 524288, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 524288, allowed_mime_types = array['image/png', 'image/jpeg'];

drop policy if exists "members upload logos" on storage.objects;
create policy "members upload logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand-logos' and private.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "members replace logos" on storage.objects;
create policy "members replace logos" on storage.objects for update to authenticated
  using (bucket_id = 'brand-logos' and private.is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'brand-logos' and private.is_member(((storage.foldername(name))[1])::uuid));
