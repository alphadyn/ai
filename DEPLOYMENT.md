# Deployment

This repository uses GitHub Pages for the portfolio site and dedicated Vercel projects for the apps that need server-side API routes. Keep the GitHub Actions workflow and app-level Vercel configuration in their host-required locations; this guide is the central reference for configuring them.

## GitHub Pages

The [deploy-pages.yml](.github/workflows/deploy-pages.yml) workflow builds and publishes the repository to GitHub Pages. It runs after GitHub's branch Pages build, on pushes, on a five-minute schedule, and on manual dispatch. The workflow prepares the Market Lens data snapshot and generates Pulse, Experiences, and Market Curve Lab share-preview pages before uploading the repository as the Pages artifact.

GitHub repository settings should use **Settings → Pages → Build and deployment → GitHub Actions**. Do not also publish from a branch source; the workflow owns the deployment artifact.

The preview-page generation steps use public app configuration and do not need deployment secrets. Pulse and Experiences share previews read public data using the public Supabase configuration in their app directories.

## Vercel projects

Vercel projects can remain separate when an app needs its own frontend or runtime configuration. The repository-root project also provides API proxy routes for the GitHub Pages apps.

| App | Vercel Root Directory | Configuration |
| --- | --- | --- |
| Market Curve Lab | `market-curve-lab` | [vercel.json](market-curve-lab/vercel.json), `api/` functions |
| Market Lens | repository root (`.`) for the Pages API; optional standalone root `market-lens` | [Market Curve Lab root proxy](api/market-curve-lab/[...path].js) and app `api/` functions |
| Alphadyn AI site and analytics API | repository root (`.`) | [package.json](package.json), [api/events.js](api/events.js) |

Set the `ai-orcin-eta-15` Vercel project's Root Directory to the repository root (`.`) so `/api/events` and `/api/market-curve-lab/*` are discovered. This catch-all routes Market Curve Lab endpoints and proxies Market Lens requests through `/api/market-curve-lab/lens?path=...` to its existing Nasdaq handler. The Vercel site's root page will then be the repository catalog; Contact Card Generator remains available at `/vcard-generator/`. Market Curve Lab can also be deployed separately, rooted at `market-curve-lab`, when its share-preview routes are needed. Market Lens keeps direct `/api` routing when served locally or from its standalone Vercel project.

## Local validation

Before changing deployment settings, run the repository tests and verify the workflow YAML parses:

```bash
./run_tests.sh
```

GitHub Actions validates the workflow when it runs. The static portfolio can be previewed locally from the repository root with:

```bash
python3 -m http.server 8000
```