import { getToken, logout, needsRefresh, refreshToken } from './auth.js?v=13';

const API = 'https://api.github.com';

// ── Rate Limit Tracking ──
let rateLimitRemaining = null;
let rateLimitReset = null;

export function getRateLimit() {
  return { remaining: rateLimitRemaining, reset: rateLimitReset };
}

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

async function apiFetch(url, opts = {}) {
  // Proactively refresh token if close to expiry
  if (needsRefresh()) await refreshToken();

  const res = await fetch(url, { ...opts, headers: { ...headers(), ...opts.headers } });

  // Track rate limits
  const remaining = res.headers.get('X-RateLimit-Remaining');
  const reset = res.headers.get('X-RateLimit-Reset');
  if (remaining !== null) rateLimitRemaining = parseInt(remaining);
  if (reset !== null) rateLimitReset = parseInt(reset) * 1000;

  // Auto-logout on 401
  if (res.status === 401) {
    logout();
    throw new Error('Session expired — please log in again');
  }

  // Rate limit exceeded
  if (res.status === 403 && rateLimitRemaining === 0) {
    const waitMin = Math.ceil((rateLimitReset - Date.now()) / 60000);
    throw new Error(`GitHub API rate limit exceeded. Resets in ${waitMin} minutes.`);
  }

  return res;
}

export async function getUser() {
  const res = await apiFetch(`${API}/user`);
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function listRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await apiFetch(`${API}/user/repos?per_page=100&page=${page}&sort=updated`);
    if (!res.ok) throw new Error('Failed to fetch repos');
    const data = await res.json();
    if (data.length === 0) break;
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

export async function getRepoInfo(owner, repo) {
  const res = await apiFetch(`${API}/repos/${owner}/${repo}`);
  if (!res.ok) throw new Error('Failed to fetch repo info');
  return res.json();
}

export async function createRepo(name, description = '') {
  const res = await apiFetch(`${API}/user/repos`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      private: false,
      auto_init: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to create repository');
  }
  return res.json();
}

export async function batchUpload(owner, repo, branch, files, message) {
  // 1. Get the current commit SHA for the branch
  const refRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  if (!refRes.ok) throw new Error('Failed to get branch ref');
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Get the base tree
  const commitRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/commits/${baseSha}`);
  if (!commitRes.ok) throw new Error('Failed to get base commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const treeItems = [];
  for (const file of files) {
    const blobRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.base64, encoding: 'base64' }),
    });
    if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
    const blobData = await blobRes.json();
    treeItems.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // 4. Create new tree
  const treeRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 5. Create commit
  const newCommitRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [baseSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // 6. Update branch ref
  const updateRes = await apiFetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRes.ok) throw new Error('Failed to update branch');

  return newCommitData;
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export async function listFiles(owner, repo, path = '') {
  const endpoint = path
    ? `${API}/repos/${owner}/${repo}/contents/${path}`
    : `${API}/repos/${owner}/${repo}/contents`;
  const res = await apiFetch(endpoint);
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error('Failed to list files');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

export async function uploadFile(owner, repo, path, base64Content, message) {
  const existing = await getFileSha(owner, repo, path);
  const body = {
    message: message || `Upload ${path} (via GitAssets)`,
    content: base64Content,
  };
  if (existing) body.sha = existing;

  const res = await apiFetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload file');
  }
  return res.json();
}

export async function deleteFile(owner, repo, path, sha, message) {
  const res = await apiFetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    body: JSON.stringify({
      message: message || `Delete ${path} (via GitAssets)`,
      sha,
    }),
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return res.json();
}

async function getFileSha(owner, repo, path) {
  const res = await apiFetch(`${API}/repos/${owner}/${repo}/contents/${path}`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha;
}

export const CDN_PROVIDERS = [
  {
    id: 'jsdelivr',
    name: 'jsDelivr',
    url: (owner, repo, branch, path) =>
      `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path}`,
  },
  {
    id: 'raw',
    name: 'GitHub Raw',
    url: (owner, repo, branch, path) =>
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`,
  },
  {
    id: 'githack',
    name: 'GitHack',
    url: (owner, repo, branch, path) =>
      `https://raw.githack.com/${owner}/${repo}/${branch}/${path}`,
  },
  {
    id: 'statically',
    name: 'Statically',
    url: (owner, repo, branch, path) =>
      `https://cdn.statically.io/gh/${owner}/${repo}/${branch}/${path}`,
  },
];

export async function renameFile(owner, repo, oldPath, newPath, message) {
  // GitHub API has no rename — fetch content, create at new path, delete old
  const res = await apiFetch(`${API}/repos/${owner}/${repo}/contents/${oldPath}`);
  if (!res.ok) throw new Error('Failed to fetch file for rename');
  const data = await res.json();

  const renameMsg = message || `Rename ${oldPath} to ${newPath} (via GitAssets)`;
  await uploadFile(owner, repo, newPath, data.content.replace(/\n/g, ''), renameMsg);

  try {
    await deleteFile(owner, repo, oldPath, data.sha, renameMsg);
  } catch (err) {
    // Upload succeeded but delete failed — file is duplicated
    throw new Error(`Renamed to ${newPath} but failed to delete original: ${err.message}`);
  }
}

export async function getCommits(owner, repo, path, page = 1) {
  const params = new URLSearchParams({ path, per_page: '30', page: String(page) });
  const res = await apiFetch(`${API}/repos/${owner}/${repo}/commits?${params}`);
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function getCommitDetail(owner, repo, sha) {
  const res = await apiFetch(`${API}/repos/${owner}/${repo}/commits/${sha}`);
  if (!res.ok) throw new Error('Failed to fetch commit');
  return res.json();
}

export function getRawUrlAtCommit(owner, repo, sha, path) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${path}`;
}

export function getCdnUrl(owner, repo, branch, path) {
  return CDN_PROVIDERS[0].url(owner, repo, branch, path);
}

export function getRawUrl(owner, repo, branch, path) {
  return CDN_PROVIDERS[1].url(owner, repo, branch, path);
}
