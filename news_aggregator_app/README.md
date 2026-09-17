# Pulse — Social News Aggregator

Pulse is a Reddit/Hacker-News-style social news aggregator. Anyone can post,
anyone can comment, and registered users get persistent identity, voting
history, and (for admins) moderation tools. The backend runs entirely on the
Python standard library (`http.server`) and the frontend is vanilla
HTML/CSS/JS — no build step, no third-party dependencies.

**Storage is Supabase (hosted Postgres) only** — there is no local/embedded
database fallback. The server requires `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
to start (see **Supabase setup** below) and refuses to start without them.

## Features

### Accounts & roles
- **Anonymous browsing and posting** — no account required to read, post, comment, or vote.
- **Registered users** (`user` role) post and comment under a persistent username.
- **Administrators** (`admin` role) can delete any post/comment and manage user roles from the API.
- A seed administrator account is created automatically on first run (see **Security** below).
- **Profile pictures**: registered users can upload an avatar (PNG/JPEG/GIF/WEBP/SVG, up to 256KB) from the nav bar. It's shown as a small icon next to their username, their posts, their comments, and in the admin Users table. Anonymous authors and users without an avatar get a generated initial icon instead.

### Posts
- Title, optional external link, rich-text body (bold/italic/lists/links via the built-in editor), and **any number of file attachments** — images, documents, audio, video, or arbitrary binary files (stored as data URLs).
- Up to 12 free-form tags per post for categorization and search.
- Upvote / downvote with one vote per user (or per anonymous browser id) — score updates live.
- Three sort modes: **Hot** (Reddit-style time-decayed rank), **New** (most recent first), **Top** (highest score first).
- Full-text search across titles, body text, and tags, combinable with tag filtering.
- Post/attachment deletion restricted to the original author or an admin (soft delete).

### Discussions
- Threaded comments with unlimited reply depth (each comment can reply to another comment).
- Comments support rich text and file/image/audio/video attachments, same as posts.
- Independent voting on comments.
- Deleted comments are replaced with a `[deleted]` placeholder so reply threads stay intact.

### Admin screen
- Visible only to users with the `admin` role (an "Admin" button appears in the top nav).
- **Overview** tab: site-wide stats (registered users, active/deleted posts, anonymous posts, comments).
- **Users** tab: view every account and promote/demote between `user` and `admin`.
- **Posts & moderation** tab: view every post (including soft-deleted ones), jump to any post, delete active posts, or restore deleted ones.
- All admin endpoints (`/api/admin/*`, restoring/deleting others' content) are enforced server-side, not just hidden in the UI.

## Supabase setup (required)

Pulse persists everything to a Supabase Postgres project — there's no local
database to fall back to, so this must be done before the server will start:

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase-schema.sql`](supabase-schema.sql) — this creates all tables and enables Row Level Security with **no** public policies.
3. In your Supabase project settings (Project Settings → API), copy the **Project URL** and the **`service_role` secret key** (not the public `anon` key).
4. Copy `.env.example` to `.env` in this folder and fill in:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-secret-key
   ```

**Why the service key and not the public anon key?** Other demo apps in this
repo talk to Supabase directly from browser JavaScript using the public
`anon` key, because their data isn't sensitive. Pulse stores password hashes
and session tokens, so the browser must never hold Supabase credentials —
all database access stays server-side through `server.py`, which enforces
auth/ownership checks before ever touching the database. The schema enables
RLS with zero policies, so even a leaked anon key can't read/write any table
directly; only the secret service key (used only by this Python process) can,
since it bypasses RLS by design. Never commit your real `.env` file (it's
already git-ignored).

## Getting started

```bash
cd news_aggregator_app
cp .env.example .env   # then fill in SUPABASE_URL / SUPABASE_SERVICE_KEY
python3 server.py
```

The server exits immediately with an error if Supabase isn't configured.
Once it starts, open http://127.0.0.1:8000 in a browser. Set `PULSE_HOST` /
`PULSE_PORT` environment variables to change the bind address/port.

A seed administrator account is created the first time the server runs:

| Username | Password       |
|----------|----------------|
| `admin`  | `ChangeMe123!` |

**Change this password immediately** (register a new admin via the database or
extend the API with a password-change endpoint before deploying anywhere
other than your own machine).

## Security

- **Passwords** are never stored in plaintext. Each password is hashed with
  **PBKDF2-HMAC-SHA256** (260,000 iterations) using a unique random 16-byte
  salt per user, and verified with a constant-time comparison.
- **Session tokens** are generated with `secrets.token_urlsafe(32)` (256 bits
  of entropy) and stored **hashed** (SHA-256) in the database — a stolen copy
  of the database cannot be replayed as a live session. Tokens expire after
  14 days.
- **Transport encryption (TLS/HTTPS)**: run `./generate_cert.sh` to create a
  local self-signed certificate (`server.pem` / `server.key`). If these files
  are present, `server.py` automatically wraps its listening socket with
  `ssl.SSLContext` (TLS 1.2+) and serves HTTPS instead of plain HTTP. For a
  real deployment, replace the self-signed certificate with one from a
  trusted CA (e.g. Let's Encrypt) — see the comments in `generate_cert.sh`.
- **Input handling**: rich-text post/comment bodies are passed through a
  whitelist HTML sanitizer (`sanitize_rich_text` in `security.py`) that strips
  `<script>`/`<style>`/`<iframe>` tags, inline event handlers (`onclick`, …),
  and `javascript:` URLs before they are stored or rendered, mitigating stored
  XSS. All other user-supplied strings (usernames, titles, tags) are
  HTML-escaped by the frontend before insertion into the DOM.
- **Path traversal protection**: static file serving resolves the requested
  path and rejects anything that would resolve outside the app directory.
- **Authorization checks**: deleting a post/comment requires either being the
  original author or having the `admin` role, enforced server-side (not just
  hidden in the UI).
- Response headers include `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer` as defense-in-depth measures.

## API overview

| Method | Path                             | Description                                   |
|--------|----------------------------------|------------------------------------------------|
| POST   | `/api/register`                  | Create an account, returns a session token      |
| POST   | `/api/login`                     | Authenticate, returns a session token           |
| POST   | `/api/logout`                    | Revoke the current session token                |
| GET    | `/api/me`                        | Current authenticated user (if any)             |
| GET    | `/api/posts?sort=&tag=&q=`       | List posts (hot/new/top, tag filter, search)    |
| POST   | `/api/posts`                     | Create a post (auth optional — anonymous OK)    |
| GET    | `/api/posts/:id`                 | Post detail with nested comment tree            |
| DELETE | `/api/posts/:id`                 | Delete a post (author or admin only)            |
| POST   | `/api/posts/:id/vote`            | Cast/change/retract a vote (`value`: 1, -1, 0)  |
| GET    | `/api/tags`                      | Tag cloud with post counts                      |
| POST   | `/api/posts/:id/comments`        | Add a comment or reply (`parentId` optional)    |
| POST   | `/api/comments/:id/vote`         | Vote on a comment                               |
| DELETE | `/api/comments/:id`              | Delete a comment (author or admin only)         |
| GET    | `/api/admin/users`               | List all users (admin only)                     |
| POST   | `/api/admin/users/:id/role`      | Change a user's role (admin only)               |
| GET    | `/api/admin/stats`               | Site-wide counts for the admin overview (admin only) |
| GET    | `/api/admin/posts`               | List every post including deleted ones (admin only)  |
| POST   | `/api/posts/:id/restore`         | Restore a soft-deleted post (admin only)        |

Authenticated requests send `Authorization: Bearer <token>`. Anonymous voting
uses a random per-browser id sent as `X-Anon-Id` (generated and stored in
`localStorage`) so anonymous visitors get one vote per post/comment.

## Files

- `server.py` — HTTP request routing, JSON API, static file serving, optional TLS, Supabase connection startup check.
- `security.py` — shared password hashing, session tokens, HTML sanitization, and hot-ranking helpers.
- `database_supabase.py` — the Supabase/Postgres storage backend (sole storage layer; requires `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`).
- `supabase-schema.sql` — Postgres table definitions + locked-down RLS.
- `.env.example` — template for Supabase credentials (copy to `.env`, which is git-ignored).
- `generate_cert.sh` — creates a local self-signed TLS certificate for HTTPS testing.
- `index.html` / `styles.css` / `app.js` — the single-page frontend (feed, post detail, threaded comments, auth modals, rich-text/file-upload post composer, admin screen).
