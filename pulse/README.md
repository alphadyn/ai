# Pulse

Pulse is a Reddit/Hacker-News-style social news aggregator. Anyone can post,
anyone can comment, and registered users get persistent identity, voting
history, and (for admins) moderation tools.

**Pulse is a fully static site** (`index.html` / `styles.css` / `app.js`) —
there is no backend server to run. The browser talks directly to a Supabase
project over HTTPS using the public "anon" key, the same pattern used by
other Supabase-backed apps in this repo. Authentication is handled by
Supabase Auth, and every authorization rule (who can post, vote, delete,
moderate, etc.) is enforced by Postgres Row Level Security policies defined
in [`supabase-schema.sql`](supabase-schema.sql) — not by client-side code, so
it can't be bypassed by someone calling the API directly. This also means
Pulse can be hosted anywhere that serves static files, including GitHub
Pages.

## Features

### Accounts & roles
- **Anonymous browsing and posting** — no account required to read, post, comment, or vote.
- **Registered users** (`user` role) post and comment under a persistent username, managed via Supabase Auth.
- **Administrators** (`admin` role) can delete/restore any post or comment and manage user roles.
- **Profiles**: registered users can open their profile screen to edit their username, display name, status, profile URL, and picture (PNG/JPEG/GIF/WEBP/SVG, up to 256KB). The picture is shown as a small icon next to their username, their posts, their comments, and in the admin Users table. Anonymous authors and users without an avatar get a generated initial icon instead.
- Usernames and avatars link to public profile screens at `index.html?user=<user-id>`, so anyone can view a user's name, status, picture, and URL.
- The search box also searches public profiles by username and links directly to matching profile screens.

### Posts
- Title, optional external link, rich-text body (bold/italic/lists/links via the built-in editor), and **any number of file attachments** — images, documents, audio, video, or arbitrary binary files (stored as data URLs).
- Up to 12 free-form tags per post for categorization and search.
- Upvote / downvote with one vote per user (or per anonymous browser id) — score updates live.
- Every post has a shareable URL in the form `index.html?post=<post-id>` that opens its detail view directly, including on static hosts.
- Share posts directly to supported apps such as Messages/RCS with the post title/body as the highlighted shared text and image attachments included for preview when the share target supports file sharing.
- Three sort modes: **Hot** (Reddit-style time-decayed rank), **New** (most recent first), **Top** (highest score first).
- Full-text search across titles, body text, and tags, combinable with tag filtering.
- Registered users can edit or delete their own posts, while anonymous posts can be edited or deleted by any signed-in user. Admins can edit or delete any post; deleting a post permanently removes its comments, votes, and attachments.

### Discussions
- Threaded comments with unlimited reply depth (each comment can reply to another comment).
- Comments support rich text and file/image/audio/video attachments, same as posts.
- Independent voting on comments.
- Deleted comments are replaced with a `[deleted]` placeholder so reply threads stay intact.

### Admin screen
- Visible only to users with the `admin` role (an "Admin" button appears in the top nav).
- **Overview** tab: site-wide stats (registered users, active posts, legacy deleted posts, anonymous posts, comments).
- **Users** tab: view every account and promote/demote between `user` and `admin`.
- **Posts & moderation** tab: view every post, jump to any post, permanently delete posts, and clean up or restore older soft-deleted rows from previous schema versions.
- These aren't just hidden UI — the database itself rejects role changes and restores from anyone whose Postgres role isn't `admin` (see **How authorization works** below).

## Setup (required before first use)

1. Create a free project at [supabase.com](https://supabase.com), or reuse an existing one — Pulse's tables are namespaced as `pulse_profiles`, `pulse_posts`, `pulse_comments`, `pulse_post_votes`, and `pulse_comment_votes` so they won't collide with other apps' tables in the same project (e.g. Nexus CMS's `media_items`).
2. Open the SQL editor and run the entire [`supabase-schema.sql`](supabase-schema.sql) file — this creates only the `pulse_profiles`/`pulse_posts`/`pulse_comments`/vote tables and `pulse_` voting RPC functions, then locks everything down with Row Level Security. **This script drops and recreates only Pulse's namespaced tables every time it's run**, so re-running it later (e.g. after a schema update) wipes any Pulse posts/comments/accounts created so far — it does not touch other apps' objects.
  If the app reports that a profile could not be created, run [`profile-row-migration.sql`](profile-row-migration.sql) once. It preserves existing data, adds the current profile columns, restores the own-profile insert policy, and reloads the PostgREST schema cache.
  If Pulse is already running and you only need to add the profile fields, run [`profile-fields-migration.sql`](profile-fields-migration.sql) instead. It preserves existing data and reloads the PostgREST schema cache, fixing errors such as `Could not find the 'profile_url' column of 'profiles' in the schema cache`.
  If Pulse is already running and you only need to fix post deletion, run [`post-delete-migration.sql`](post-delete-migration.sql) instead. It preserves existing data while allowing permanent post deletes and blocking new soft-deleted post rows.
  If Pulse is already running and anonymous visitors can still edit/delete anonymous posts, run [`anon-post-permissions-migration.sql`](anon-post-permissions-migration.sql). It preserves existing data and restricts editing/deleting anonymous posts to signed-in users (registered or admin) only.
  If an administrator can log in but the Admin screen still says `Admin access required.`, run [`admin-role-migration.sql`](admin-role-migration.sql). It preserves existing data and updates the admin helper used by the app and RLS policies.
3. **Turn off email confirmation**: Authentication → Providers → Email → disable **"Confirm email"**. Pulse signs people up with a synthetic `username@pulse.local` address (so nobody needs a real inbox just to use a demo forum) — with confirmation left on, nobody could ever confirm that address and sign-ups would be stuck forever.
4. In Project Settings → API, copy the **Project URL** and the **public `anon` key** (not the `service_role` secret key — never put that in client-side code).
5. Edit [`supabase-config.js`](supabase-config.js):
   ```js
   window.PULSE_SUPABASE = {
     url: 'https://your-project.supabase.co',
     anonKey: 'your-anon-public-key'
   };
   ```
6. Serve the folder with any static file server, e.g. `python3 -m http.server 8000` from inside `news_aggregator_app/`, then open `http://localhost:8000`. It also works out of the box on GitHub Pages or any other static host.

### Link previews for shared posts (optional but recommended)

Messaging apps (iMessage/SMS, WhatsApp, Slack…) don't run JavaScript when they
unfurl a link — they just read the Open Graph tags of whatever HTML the URL
returns. On a static host that's always the generic `index.html`, so every
shared post would show the same Pulse artwork.
[`../market_curve_lab/api/pulse-share.js`](../market_curve_lab/api/pulse-share.js)
is a Vercel serverless function that looks the post up and returns per-post OG
tags (title, body excerpt, and the post's own first image, served straight from
the attachment), plus a readable card with an "Open in Pulse" link. It lives in
`market_curve_lab/` only because that folder is the root directory of this
repository's existing Vercel project — GitHub Pages still serves Pulse itself.

The Vercel project needs these environment variables:

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | your project URL, e.g. `https://xxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | the same public anon key used in `supabase-config.js` |
| `APP_BASE_URL` | optional; where the app itself is hosted (defaults to the GitHub Pages URL) |

`shareOrigin` in [`supabase-config.js`](supabase-config.js) points at that
deployment, so shared links look like
`https://ai-orcin-eta-15.vercel.app/api/pulse-share?post=<post-id>`. Set it to
`null` to share plain app URLs instead.

### Making your first admin

New accounts always start with the `user` role — there's no seed admin,
since a static site has no trusted place to create one automatically. After
signing up your own account through the app, promote it in the Supabase SQL
editor:

```sql
update public.pulse_profiles set role = 'admin' where username = 'your-username';
```

Re-running `supabase-schema.sql` later drops and recreates every Pulse table,
so it also clears this role change along with all other data — repeat this
step afterward if you do.

## How authorization works (no backend, so Postgres is the trust boundary)

Because there's no server to enforce rules, **Row Level Security policies
and a couple of `SECURITY DEFINER` functions in `supabase-schema.sql` are the
only thing standing between a visitor and the database** — the anon key is
public and anyone can call the Supabase REST API directly with it, so every
rule has to hold up even against a client that skips `app.js` entirely:

- **Posts/comments**: anyone can `INSERT` a row where `author_id` is either their own user id or `null` (anonymous). Only the original author or an admin can `UPDATE` or `DELETE` a registered user's post; anonymous posts may be updated or deleted by any signed-in user (registered or admin), but not by anonymous visitors. Deleting a post uses a real `DELETE`, so Postgres cascades its comments and votes. A trigger blocks new post soft-deletes by rejecting direct `is_deleted: false → true` patches, while still allowing admins to restore older soft-deleted rows from previous schema versions.
- **Voting**: the `upvotes`/`downvotes` columns are never writable directly by clients. Voting goes through `cast_post_vote()` / `cast_comment_vote()`, `SECURITY DEFINER` Postgres functions that atomically apply the vote-count delta — a client can't just `PATCH` a post to set an arbitrary score.
- **Roles**: a user can update their own `profiles` row (e.g. their avatar), but a trigger silently reverts any change to the `role` column unless the request comes from an existing admin. A regular user calling the API directly cannot self-promote.
- **Profiles are public** (username, avatar, role, join date) — like a forum member list — so every post/comment can show author badges. Nothing sensitive (no emails, password hashes, or session tokens) lives in a client-readable table; Supabase Auth keeps those internally.

## Security

- **Passwords** are handled entirely by Supabase Auth (industry-standard hashing, session/JWT issuance, refresh tokens) — Pulse's own code never sees or stores a raw password.
- **Transport encryption**: all traffic goes over HTTPS to your Supabase project (Supabase provisions TLS by default) and to whatever static host you deploy Pulse's own files to (GitHub Pages, Netlify, etc. all serve over HTTPS).
- **Input handling**: rich-text post/comment bodies are passed through a whitelist HTML sanitizer (`sanitizeRichText` in `app.js`) that strips `<script>`/`<style>`/`<iframe>` tags, inline event handlers (`onclick`, …), and `javascript:` URLs. This runs **both before submitting and again every time content is rendered**, so even content inserted by a client that bypassed the sanitizer on the way in is still neutralized on the way out.
- **Authorization**: every write is checked in Postgres via RLS (see above), not just hidden in the UI.
- **Storage limits**: `CHECK` constraints in the schema cap title length, tag count, and avatar size directly in the database, since the client can no longer be trusted as the only enforcement point.

**Known limitation**: anonymous votes are keyed by a random id the browser generates and stores in `localStorage`, not a verified identity — like the original design, this stops casual double-voting in the same browser but isn't cryptographically tamper-proof against someone spoofing many different anonymous voter keys. This is an inherent trade-off of supporting fully anonymous voting with no server.

## Files

- `index.html` / `styles.css` / `app.js` — the entire application (feed, post detail, threaded comments, auth modals, rich-text/file-upload post composer, admin screen, and all Supabase REST/Auth calls).
- `supabase-config.js` — your project's public URL + anon key (safe to commit; it's meaningless without the RLS policies in your project).
- `supabase-schema.sql` — table definitions, RLS policies, and the vote-casting RPC functions. Run this once per Supabase project.
- `../market_curve_lab/api/pulse-share.js` — Vercel serverless endpoint that renders per-post Open Graph metadata (and the post's image) so shared links preview the actual post in messaging apps.
