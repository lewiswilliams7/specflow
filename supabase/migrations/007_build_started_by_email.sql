-- The sign-off report names who started each build. auth.users isn't readable from the app, so the email is kept
-- on the build row when it starts.
alter table public.builds add column if not exists started_by_email text;
