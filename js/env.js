// ── Self-host configuration ──
// Change this URL when deploying your own instance.
// Point it to your Cloudflare Worker that handles GitHub OAuth.
export const WORKER_URL = 'https://auth-git-assets.sebesta.dev';

// Optional: S3-compatible API worker URL.
// Deploy worker-s3/ and set this to your worker's URL.
export const S3_WORKER_URL = 'https://s3-git-assets.sebesta.dev';
