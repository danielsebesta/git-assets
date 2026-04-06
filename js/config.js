import { listRepos } from './github.js?v=9';

const CONFIG_KEY = 'gitassets_config';
const REPOS_KEY = 'gitassets_repos';
export const ASSETS_ROOT = '_assets';

export function getConfig() {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  addSavedRepo(config);
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function getSavedRepos() {
  const stored = localStorage.getItem(REPOS_KEY);
  return stored ? JSON.parse(stored) : [];
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

export async function autoDetectRepo(username) {
  const repos = await listRepos();

  // Look for a fork of git-assets
  const fork = repos.find(
    (r) => r.fork && r.name === 'git-assets'
  );
  if (fork) {
    return {
      owner: fork.owner.login,
      repo: fork.name,
      branch: fork.default_branch,
    };
  }

  // Look for any repo named git-assets owned by the user
  const own = repos.find(
    (r) => r.name === 'git-assets' && r.owner.login === username
  );
  if (own) {
    return {
      owner: own.owner.login,
      repo: own.name,
      branch: own.default_branch,
    };
  }

  return null;
}

// ── Favorites ──
const FAVS_KEY = 'gitassets_favorites';

export function getFavorites() {
  const stored = localStorage.getItem(FAVS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function toggleFavorite(path) {
  const favs = getFavorites();
  const idx = favs.indexOf(path);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(path);
  localStorage.setItem(FAVS_KEY, JSON.stringify(favs));
  return idx < 0; // returns true if added
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
  // Remove if already exists
  const filtered = recent.filter((r) => r.path !== path);
  filtered.unshift(entry);
  localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
}

export function getRecent() {
  const stored = localStorage.getItem(RECENT_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function getRepoList(repos) {
  return repos
    .filter((r) => r.permissions?.push)
    .map((r) => ({
      owner: r.owner.login,
      repo: r.name,
      branch: r.default_branch,
      fullName: r.full_name,
    }));
}
