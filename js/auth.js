import { WORKER_URL } from './env.js';

const TOKEN_KEY = 'gitassets_token';
const TOKEN_TS_KEY = 'gitassets_token_ts';
const TOKEN_EXP_KEY = 'gitassets_token_exp';
const REFRESH_KEY = 'gitassets_refresh_token';

// Refresh 5 minutes before expiry
const REFRESH_BUFFER = 5 * 60 * 1000;

export function login() {
  window.location.href = `${WORKER_URL}/login`;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_TS_KEY);
  localStorage.removeItem(TOKEN_EXP_KEY);
  localStorage.removeItem(REFRESH_KEY);
  window.location.hash = '';
  window.location.reload();
}

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const expiresAt = parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0');
  if (expiresAt && Date.now() > expiresAt) {
    // Token expired — try refresh in background, return null for now
    refreshToken();
    return null;
  }

  return token;
}

export function isLoggedIn() {
  return !!getToken();
}

export function needsRefresh() {
  const expiresAt = parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0');
  if (!expiresAt) return false;
  return Date.now() > expiresAt - REFRESH_BUFFER;
}

let refreshPromise = null;

export async function refreshToken() {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  const refreshTok = localStorage.getItem(REFRESH_KEY);
  if (!refreshTok) {
    logout();
    return null;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${WORKER_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshTok }),
      });

      if (!res.ok) {
        logout();
        return null;
      }

      const data = await res.json();
      if (data.error) {
        logout();
        return null;
      }

      saveTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } catch {
      // Network error — don't logout, just return null
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function saveTokens(accessToken, refreshTok, expiresIn) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
  if (refreshTok) {
    localStorage.setItem(REFRESH_KEY, refreshTok);
  }
  if (expiresIn) {
    const expiresAt = Date.now() + parseInt(expiresIn) * 1000;
    localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
  }
}

export function handleAuthCallback() {
  const hash = window.location.hash;

  if (hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    const refreshTok = params.get('refresh_token');
    const expiresIn = params.get('expires_in');

    if (token) {
      saveTokens(token, refreshTok, expiresIn);
      window.history.replaceState(null, '', window.location.pathname);
      return true;
    }
  }

  if (hash.includes('error=')) {
    const params = new URLSearchParams(hash.substring(1));
    const error = params.get('error');
    window.history.replaceState(null, '', window.location.pathname);
    throw new Error(error || 'Authentication failed');
  }

  return false;
}
