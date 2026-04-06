import { getToken } from './auth.js';

const API = 'https://api.github.com';

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

export async function getUser() {
  const res = await fetch(`${API}/user`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function listRepos() {
  const repos = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${API}/user/repos?per_page=100&page=${page}&sort=updated`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error('Failed to fetch repos');
    const data = await res.json();
    if (data.length === 0) break;
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return repos;
}

export async function listFiles(owner, repo, path = '') {
  const endpoint = path
    ? `${API}/repos/${owner}/${repo}/contents/${path}`
    : `${API}/repos/${owner}/${repo}/contents`;
  const res = await fetch(endpoint, { headers: headers() });
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
    message: message || `Upload ${path}`,
    content: base64Content,
  };
  if (existing) body.sha = existing;

  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to upload file');
  }
  return res.json();
}

export async function deleteFile(owner, repo, path, sha, message) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'DELETE',
    headers: headers(),
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
    }),
  });
  if (!res.ok) throw new Error('Failed to delete file');
  return res.json();
}

async function getFileSha(owner, repo, path) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: headers(),
  });
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

export function getCdnUrl(owner, repo, branch, path) {
  return CDN_PROVIDERS[0].url(owner, repo, branch, path);
}

export function getRawUrl(owner, repo, branch, path) {
  return CDN_PROVIDERS[1].url(owner, repo, branch, path);
}
