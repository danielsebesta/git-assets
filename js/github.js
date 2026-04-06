import { getToken } from './auth.js?v=8';

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

export async function getRepoInfo(owner, repo) {
  const res = await fetch(`${API}/repos/${owner}/${repo}`, { headers: headers() });
  if (!res.ok) throw new Error('Failed to fetch repo info');
  return res.json();
}

export async function batchUpload(owner, repo, branch, files, message) {
  // Git Data API: create blobs → get current tree → build new tree → create commit → update ref
  // This creates a single commit for all files (1 push instead of N)

  // 1. Get the current commit SHA for the branch
  const refRes = await fetch(`${API}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
    headers: headers(),
  });
  if (!refRes.ok) throw new Error('Failed to get branch ref');
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Get the base tree
  const commitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits/${baseSha}`, {
    headers: headers(),
  });
  if (!commitRes.ok) throw new Error('Failed to get base commit');
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const treeItems = [];
  for (const file of files) {
    const blobRes = await fetch(`${API}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: headers(),
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
  const treeRes = await fetch(`${API}/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const treeData = await treeRes.json();

  // 5. Create commit
  const newCommitRes = await fetch(`${API}/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [baseSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error('Failed to create commit');
  const newCommitData = await newCommitRes.json();

  // 6. Update branch ref
  const updateRes = await fetch(`${API}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRes.ok) throw new Error('Failed to update branch');

  return newCommitData;
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB (GitHub enforced limit)

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

export async function renameFile(owner, repo, oldPath, newPath, message) {
  // GitHub API has no rename — fetch content, create at new path, delete old
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${oldPath}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to fetch file for rename');
  const data = await res.json();

  await uploadFile(owner, repo, newPath, data.content.replace(/\n/g, ''), message || `Rename ${oldPath} to ${newPath}`);
  await deleteFile(owner, repo, oldPath, data.sha, message || `Rename ${oldPath} to ${newPath}`);
}

export async function getCommits(owner, repo, path, page = 1) {
  const params = new URLSearchParams({ path, per_page: '30', page: String(page) });
  const res = await fetch(`${API}/repos/${owner}/${repo}/commits?${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
}

export async function getCommitDetail(owner, repo, sha) {
  const res = await fetch(`${API}/repos/${owner}/${repo}/commits/${sha}`, {
    headers: headers(),
  });
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
