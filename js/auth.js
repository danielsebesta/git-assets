const TOKEN_KEY = 'gitassets_token';
const WORKER_URL = 'https://auth-git-assets.sebesta.dev';

export function login() {
  window.location.href = `${WORKER_URL}/login`;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.hash = '';
  window.location.reload();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return !!getToken();
}

export function handleAuthCallback() {
  const hash = window.location.hash;

  if (hash.includes('access_token=')) {
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('access_token');
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
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
