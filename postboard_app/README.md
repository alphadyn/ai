# Postboard

Postboard is a small personal activity log for saving short updates with metadata, attachments, and optional rich-text formatting.

## Features

- Rich-text message composer with bold, italic, underline, and bullet list formatting
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

The demo uses public CRUD policies so it can run as a static frontend without auth. For production or private usage, replace those policies with authenticated, user-scoped access.

## Notes

- The message editor sanitizes HTML before saving so only a safe subset of formatting is preserved.
- Large attachments are limited to 4 MB per upload.
- Images can be clicked to open in a full-size viewer.
- Use the export button to create a JSON archive and the import button to restore it later.
