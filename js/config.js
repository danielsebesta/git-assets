import { listRepos } from './github.js?v=14';

const CONFIG_KEY = 'gitassets_config';
const REPOS_KEY = 'gitassets_repos';
export const ASSETS_ROOT = '';

function safeParse(key, fallback = null) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function getConfig() {
  return safeParse(CONFIG_KEY);
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  addSavedRepo(config);
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function getSavedRepos() {
  return safeParse(REPOS_KEY, []);
}

export function addSavedRepo(config) {
  const repos = getSavedRepos();
  const key = `${config.owner}/${config.repo}`;
  if (!repos.find((r) => `${r.owner}/${r.repo}` === key)) {
    repos.push(config);
    localStorage.setItem(REPOS_KEY, JSON.stringify(repos));
  }
}

export function removeSavedRepo(owner, repo) {
  const repos = getSavedRepos().filter((r) => !(r.owner === owner && r.repo === repo));
  localStorage.setItem(REPOS_KEY, JSON.stringify(repos));
}

// ── Favorites ──
const FAVS_KEY = 'gitassets_favorites';

export function getFavorites() {
  return safeParse(FAVS_KEY, []);
}

export function toggleFavorite(path) {
  const favs = getFavorites();
  const idx = favs.indexOf(path);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(path);
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  return idx < 0;
}

export function isFavorite(path) {
  return getFavorites().includes(path);
}

// ── Recent Uploads ──
const RECENT_KEY = 'gitassets_recent';
const MAX_RECENT = 10;

export function addRecent(path, owner, repo, branch) {
  const recent = getRecent();
  const entry = { path, owner, repo, branch, time: Date.now() };
  const filtered = recent.filter((r) => r.path !== path);
  filtered.unshift(entry);
  localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
}

export function getRecent() {
  return safeParse(RECENT_KEY, []);
}

export function getRepoList(repos) {
  const list = repos
    .filter((r) => r.permissions?.push && !r.archived)
    .map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      branch: r.default_branch,
      fullName: r.full_name,
      avatarUrl: r.owner.avatar_url,
      description: r.description || '',
      isPrivate: r.private,
      language: r.language || '',
      stars: r.stargazers_count || 0,
      updatedAt: r.updated_at,
      sizeKB: r.size || 0,
    }));
  // Public first, then by last activity, then by stars
  list.sort((a, b) =>
    (a.isPrivate - b.isPrivate) ||
    (new Date(b.updatedAt) - new Date(a.updatedAt)) ||
    (b.stars - a.stars)
  );
  return list;
}
