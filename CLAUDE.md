# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GitAssets** is an open-source, self-hosted tool that turns a GitHub repository into a free CDN for images and static assets. Users upload/manage files in their own GitHub repo and serve them via jsDelivr CDN.

- **Repo name:** `git-assets`
- **Project/brand name:** GitAssets
- **License:** MIT
- **Language:** All code, docs, and UI in English

## Architecture

```
Landing (/)  →  static HTML, no JS framework
App (/app)   →  GitHub API (direct, client-side)  →  GitHub Repo (storage)
                                                          ↓
                                                jsDelivr CDN (public delivery)

Cloudflare Worker (auth only)
  └── handles GitHub App OAuth login, token exchange, and refresh
  └── configurable via js/env.js (single WORKER_URL)
```

- **Frontend:** Vanilla HTML/CSS/JS (no build step, no framework). Two pages: landing (`/`) and app (`/app`). All file operations happen client-side via GitHub API.
- **Backend (auth only):** A Cloudflare Worker. Handles GitHub App OAuth token exchange and refresh only.
- **Storage:** User's own GitHub repository. Files can be stored anywhere in the repo.
- **CDN:** jsDelivr at `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/path/to/file`

## Repo Structure

```
index.html          — Landing page (static, no app code)
app/index.html      — App page (loads JS, shows spinner → setup/dashboard)
css/
  style.css         — App styles (dark/light theme)
  landing.css       — Landing page styles (animations, hero, sections)
js/
  env.js            — Self-host config (WORKER_URL — the only hardcoded URL)
  app.js            — Init, auth check, routing between setup/dashboard
  auth.js           — GitHub App OAuth, token refresh, localStorage
  github.js         — GitHub API client (list, upload, delete, rename, batch, create repo)
  config.js         — Repo picker logic, favorites, recents, localStorage config
  ui.js             — DOM rendering (setup wizard, dashboard, file grid, modals, toasts)
  compress.js       — Client-side image compression (WebP, AVIF, JPEG, PNG)
  selection.js      — OS-style file selection (click, shift, ctrl)
oembed.json         — oEmbed discovery
site.webmanifest    — PWA manifest
worker/
  index.js          — Cloudflare Worker (OAuth login, callback, refresh)
  wrangler.toml     — Worker deployment config
.github/workflows/
  pages.yml         — GitHub Actions deploy (frontend files only)
```

## Page Routing

- `/` — Landing page. Logged-in users (token in localStorage) redirect to `/app`.
- `/app` — App. Not logged in → redirects to OAuth login. Logged in → setup wizard or dashboard.
- Login links on landing use `WORKER_URL` from `js/env.js` (set dynamically via JS module).

## Authentication

- **GitHub App OAuth** (not OAuth App) with refresh tokens
- Worker endpoints: `GET /login`, `GET /callback`, `POST /refresh`
- Callback redirects to `/app#access_token=...&refresh_token=...&expires_in=...`
- Tokens stored in localStorage, proactively refreshed before expiry
- `js/auth.js` imports `WORKER_URL` from `js/env.js`

## Self-Hosting

Only two things to change:

1. **`js/env.js`** — set `WORKER_URL` to your Cloudflare Worker URL
2. **`worker/wrangler.toml`** — set `FRONTEND_URL` and `WORKER_URL` vars, configure your domain

No other files contain instance-specific URLs. Meta tags use relative paths.

## Development

No build step. Serve with any static server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Worker development:
```bash
cd worker
npx wrangler dev    # local dev
npx wrangler deploy # deploy to Cloudflare
```

Worker secrets (set via `wrangler secret put`):
- `GITHUB_CLIENT_ID` — from GitHub App
- `GITHUB_CLIENT_SECRET` — from GitHub App

## Key Features

- **File management:** Upload, delete, rename, move, batch operations, folder creation
- **Image compression:** Client-side via OffscreenCanvas, before/after comparison slider, format selection (WebP/AVIF/JPEG/PNG), quality control
- **File previews:** Images, video, audio, PDF, text/code files inline
- **Multi-format output:** Copy CDN URL, HTML snippet, Markdown snippet
- **Multiple CDN providers:** jsDelivr (default), GitHub Raw, GitHack, Statically
- **Repo management:** Create new repos, switch repos, public/private detection with warnings
- **File history:** Git commit log per file, version comparison
- **OS-style selection:** Click, Shift+click, Ctrl+click for multi-select
- **Dark/light theme**

## Key Design Decisions

- **No build step:** Vanilla JS with ES modules. No bundler, no transpiler.
- **Single config file:** `js/env.js` is the only file with a hardcoded URL.
- **Landing/App split:** Landing page (`/`) is pure static HTML for SEO. App (`/app`) loads JS.
- **Token stays client-side:** Never sent to any backend except GitHub's API directly.
- **GitHub App (not OAuth App):** Supports refresh tokens, granular permissions.

## Non-Goals

- Not a full-scale CDN replacement
- Not optimized for high-traffic production workloads
- Not a CMS
