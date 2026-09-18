# Postboard

Postboard is a small personal activity log for saving short updates with metadata, attachments, and optional rich-text formatting.

## Features

- Rich-text message composer with headings, quotes, links, code, lists, highlighting, subscript, superscript, and other formatting controls
- Person name, username, date, time, and optional location fields
- Post editing and deletion in the timeline
- Search across post text and metadata
- File and image uploads with preview support
- JSON export/import backup and restore
- Supabase-backed storage for browser-based persistence

## How to run

1. Open the project in a browser, or serve it locally from this folder:

```bash
cd /path/to/ai/postboard_app
python3 -m http.server 8000
```

2. Visit http://localhost:8000 in a browser.

## Supabase setup

1. Create a Supabase project.
2. Run the SQL from [supabase-schema.sql](supabase-schema.sql) in the Supabase SQL editor.
3. Update [supabase-config.js](supabase-config.js) with your project URL and anon key.
4. Reload the app.

If you point Postboard at a Supabase project that is shared with other apps, make sure none of them already use a table named `posts` — Postboard uses its own `postboard_posts` table to avoid any collision. Re-run [supabase-schema.sql](supabase-schema.sql) if you previously created a `posts` table for this app; it now creates `postboard_posts` instead.

The demo uses public CRUD policies so it can run as a static frontend without auth. For production or private usage, replace those policies with authenticated, user-scoped access.

Create a public Storage bucket named `postboard-attachments` in Supabase, or change `storageBucket` in [supabase-config.js](supabase-config.js) to match a bucket you already created. The app uploads attached files there and stores only the URL metadata in the posts table.

## Notes

- The message editor sanitizes HTML before saving so only a safe subset of formatting is preserved. New messages start as plain text; use the toolbar to apply formatting.
- Large attachments are limited to 15 MB per upload.
- Images can be clicked to open in a full-size viewer.
- Use the export button to create a JSON archive and the import button to restore it later.
