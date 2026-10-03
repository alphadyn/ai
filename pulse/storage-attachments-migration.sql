-- Stores post/comment attachments as files instead of base64 inside table rows.
-- Run once in the Supabase SQL editor. The app falls back to inline data URLs
-- until this bucket exists, so running it is safe at any time.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pulse-attachments', 'pulse-attachments', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
        'video/mp4', 'video/webm', 'video/quicktime',
        'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg',
        'application/pdf', 'text/plain']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve reads without a policy; only uploads need one.
-- Anonymous posting is allowed in Pulse, so anon may upload too (no update/delete).
drop policy if exists "pulse attachments upload" on storage.objects;
create policy "pulse attachments upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pulse-attachments');
