import { listRepos } from './github.js';

const CONFIG_KEY = 'gitassets_config';
export const ASSETS_ROOT = '_assets';

export function getConfig() {
  const stored = localStorage.getItem(CONFIG_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
}

export function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
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
