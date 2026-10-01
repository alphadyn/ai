# Deployment

This repository uses GitHub Pages for the portfolio site and dedicated Vercel projects for the apps that need server-side API routes. Keep the GitHub Actions workflow and app-level Vercel configuration in their host-required locations; this guide is the central reference for configuring them.

## GitHub Pages

The [deploy-pages.yml](.github/workflows/deploy-pages.yml) workflow builds and publishes the repository to GitHub Pages. It runs after GitHub's branch Pages build, on pushes, on a five-minute schedule, and on manual dispatch. The workflow prepares the Market Lens data snapshot and generates Pulse and Market Curve Lab share-preview pages before uploading the repository as the Pages artifact.

GitHub repository settings should use **Settings → Pages → Build and deployment → GitHub Actions**. Do not also publish from a branch source; the workflow owns the deployment artifact.

The preview-page generation steps use public app configuration and do not need deployment secrets. Pulse share previews read public posts using the public Supabase configuration in its app directory.

## Vercel projects

Vercel projects remain separate because their serverless APIs and runtime configuration are app-specific. Set each project's Root Directory in Vercel to the corresponding folder; do not move its Vercel configuration into a repository-wide file.

| App | Vercel Root Directory | Configuration |
| --- | --- | --- |
| Market Curve Lab | `market-curve-lab` | [vercel.json](market-curve-lab/vercel.json), `api/` functions |
| Market Lens | `market-lens` | `api/` functions; Vercel's default routing is sufficient |
| Alphadyn AI site and analytics API | repository root (`.`) | [package.json](package.json), [api/events.js](api/events.js) |

Set the `ai-orcin-eta-15` Vercel project's Root Directory to the repository root (`.`) so `/api/events` and `/api/market-curve-lab/*` are discovered. The latter routes reuse Market Curve Lab's companies, search, and analysis handlers. The Vercel site's root page will then be the repository catalog; Contact Card Generator remains available at `/vcard-generator/`. The Market Curve Lab project can also be deployed separately, rooted at `market-curve-lab`, when its share-preview routes are needed. Market Lens uses its own Vercel API endpoint configured in its frontend.

## Local validation

Before changing deployment settings, run the repository tests and verify the workflow YAML parses:

```bash
./run_tests.sh
```

GitHub Actions validates the workflow when it runs. The static portfolio can be previewed locally from the repository root with:

```bash
python3 -m http.server 8000
```