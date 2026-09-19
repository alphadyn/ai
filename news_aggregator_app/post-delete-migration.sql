-- Pulse permanent post deletion migration
-- Run this once in the Supabase SQL Editor for an existing Pulse project.
-- This preserves existing data while making future app deletes remove the
-- post row itself, which cascades comments and votes through the existing
-- foreign-key relationships.

create or replace function public.enforce_post_delete_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_deleted is distinct from old.is_deleted then
    if new.is_deleted = true then
      raise exception 'Delete posts with DELETE so related data is removed.';
    else
      if not public.is_admin() then
        raise exception 'Admin access required to restore a post.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_delete_guard on public.posts;
create trigger posts_delete_guard
  before update on public.posts
  for each row execute function public.enforce_post_delete_rules();

drop policy if exists "owner or admin can delete posts" on public.posts;
create policy "owner or admin can delete posts" on public.posts
  for delete using (author_id is null or author_id = auth.uid() or public.is_admin());

drop policy if exists "owner or admin can update posts" on public.posts;
create policy "owner or admin can update posts" on public.posts
  for update using (author_id is null or author_id = auth.uid() or public.is_admin())
  with check (author_id is null or author_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';