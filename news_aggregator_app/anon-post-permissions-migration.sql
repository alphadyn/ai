-- Pulse anonymous post permissions migration.
--
-- Run this in the Supabase SQL editor for an existing Pulse project to
-- restrict editing/deleting anonymous posts to signed-in users (registered
-- or admin) only. Previously any visitor, including anonymous ones, could
-- edit or delete anonymous posts. This preserves all existing data.

drop policy if exists "owner or admin can update posts" on public.pulse_posts;
create policy "owner or admin can update posts" on public.pulse_posts
  for update using (
    (auth.uid() is not null and (author_id = auth.uid() or author_id is null))
    or public.pulse_is_admin()
  )
  with check (
    (auth.uid() is not null and (author_id = auth.uid() or author_id is null))
    or public.pulse_is_admin()
  );

drop policy if exists "owner or admin can delete posts" on public.pulse_posts;
create policy "owner or admin can delete posts" on public.pulse_posts
  for delete using (
    (auth.uid() is not null and (author_id = auth.uid() or author_id is null))
    or public.pulse_is_admin()
  );

notify pgrst, 'reload schema';
