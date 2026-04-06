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
Frontend (GitHub Pages)  →  GitHub API (direct, client-side)  →  GitHub Repo (storage)
                                                                      ↓
                                                      jsDelivr CDN (public delivery)

Author's Cloudflare Worker (shared, auth only)
  └── handles OAuth login + token exchange, nothing else
  └── end users do NOT need to deploy their own Worker
```

- **Frontend:** Vanilla HTML/CSS/JS (no build step, no framework). Static SPA on GitHub Pages. All file operations (upload, delete, list, URL generation) happen client-side via GitHub API.
- **Backend (auth only):** A single Cloudflare Worker hosted by the project author. Handles GitHub OAuth token exchange only. End users never touch this.
- **Storage:** User's own GitHub repository, assets stored under `_assets/` (underscore prefix makes Jekyll/GitHub Pages ignore this folder, so assets are NOT served via Pages — only via jsDelivr/CDN)
- **CDN:** jsDelivr at `https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/path/to/file`

## User Onboarding Flow

1. User forks the repo
2. Enables GitHub Pages
3. Opens their page → clicks "Login with GitHub"
4. Auto-detects their fork as storage repo (or picks from list)
5. Done — upload, manage, copy CDN URLs

No env vars, no config files, no Worker deployment needed for end users.

## Authentication

- GitHub OAuth via the author's centrally-hosted Worker
- Worker endpoints: `GET /login` (redirect to GitHub), `GET /callback` (exchange code → token)
- Token returned to frontend via URL fragment, stored in localStorage
- All subsequent GitHub API calls use the token client-side

## Repo Structure

```
index.html          — SPA entry point
css/style.css       — All styles (dark theme, GitHub-inspired)
js/
  app.js            — Init, routing between login/setup/dashboard
  auth.js           — OAuth redirect, token extraction, localStorage
  github.js         — GitHub API client (list, upload, delete, URL helpers)
  config.js         — Repo auto-detect, setup wizard, localStorage config
  ui.js             — DOM rendering (login, setup, file grid, modals, toasts)
worker/
  index.js          — Cloudflare Worker (OAuth only)
  wrangler.toml     — Worker deployment config
```

## Development

No build step. Open `index.html` in a browser or serve with any static server:

```bash
cd /path/to/git-assets
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

Worker secrets (set via `wrangler secret put` or Cloudflare dashboard):
- `GITHUB_CLIENT_ID` — from GitHub OAuth App
- `GITHUB_CLIENT_SECRET` — from GitHub OAuth App
- `WORKER_URL` — deployed Worker URL
- `FRONTEND_URL` — GitHub Pages URL

## Key Design Decisions

- **Zero-config for end users:** The author hosts the OAuth Worker. Users just fork + enable Pages.
- **Minimal backend surface:** Worker does auth only. All GitHub API calls happen client-side.
- **No build step:** Vanilla JS with ES modules. No bundler, no transpiler.
- **Auto-detect repo:** After login, automatically finds user's fork of git-assets. Fallback to manual repo picker.
- **Token stays client-side:** Never sent to any backend except GitHub's API directly.

## Non-Goals

- Not a full-scale CDN replacement
- Not optimized for high-traffic production workloads
- Not a CMS
