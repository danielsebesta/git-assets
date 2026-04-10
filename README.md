# GitAssets

Turn any GitHub repository into a free CDN for images and static assets. Upload files to your own repo, serve them instantly via [jsDelivr](https://www.jsdelivr.com/).

**[Live Demo](https://git-assets.sebesta.dev)** · **[Use this template](https://github.com/danielsebesta/git-assets/generate)**

## Features

- **Upload & manage** — drag & drop, paste from clipboard, batch upload, folders
- **Instant CDN URLs** — copy links served via jsDelivr, GitHub Raw, GitHack, or Statically
- **Image compression** — client-side WebP/AVIF/JPEG/PNG conversion with before/after preview
- **File previews** — images, video, audio, PDF, text/code inline
- **Folder previews** — optional 2×2 thumbnail grid showing folder contents
- **OS-style selection** — click, Shift+click, Ctrl+click for multi-select
- **File history** — git commit log per file, version comparison
- **Dark & light theme**
- **No build step** — vanilla HTML/CSS/JS, ready to deploy

## How it works

```
You → GitAssets UI → GitHub API → Your Repo → jsDelivr CDN → Users
```

Files are stored in your GitHub repository. Public repos are served through jsDelivr CDN with global edge caching. Everything runs client-side — the only backend is a small Cloudflare Worker that handles OAuth login.

## Self-hosting

GitAssets is designed to be self-hosted. You need two things:

### 1. Create a GitHub App

1. Go to [github.com/settings/apps/new](https://github.com/settings/apps/new)
2. Set **Callback URL** to `https://your-worker.example.com/callback`
3. Under **Permissions → Repository**, set **Contents** to **Read and write**
4. Note your **Client ID** and generate a **Client Secret**

### 2. Deploy the auth worker

The `worker/` directory contains a Cloudflare Worker that handles OAuth token exchange.

```bash
cd worker
```

Edit `wrangler.toml`:

```toml
[vars]
FRONTEND_URL = "https://your-site.example.com"
WORKER_URL = "https://your-worker.example.com"
```

Set secrets and deploy:

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler deploy
```

### 3. Deploy the frontend

Edit `js/env.js` — point to your worker:

```js
export const WORKER_URL = 'https://your-worker.example.com';
```

Deploy to any static host (GitHub Pages, Netlify, Vercel, etc.). The included GitHub Actions workflow deploys to GitHub Pages automatically on push.

## Development

No build step. Serve with any static server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` and you're ready.

## Project structure

```
index.html          Landing page (static HTML)
app/index.html      App (loads JS modules)
css/
  style.css         App styles (dark/light theme)
  landing.css       Landing page styles
js/
  env.js            Single config file (WORKER_URL)
  app.js            Init, auth check, routing
  auth.js           GitHub App OAuth + token refresh
  github.js         GitHub API client
  config.js         Repo picker, favorites, recents
  ui.js             All UI rendering
  compress.js       Client-side image compression
  selection.js      OS-style file selection
worker/
  index.js          Cloudflare Worker (OAuth only)
  wrangler.toml     Worker config
```

## License

[MIT](LICENSE) — Daniel Šebesta
