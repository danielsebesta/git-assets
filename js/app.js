import { WORKER_URL } from './env.js';
import { isLoggedIn, handleAuthCallback, getToken } from './auth.js?v=13';
import { getUser } from './github.js?v=13';
import { getConfig } from './config.js?v=13';
import { renderLogin, renderSetup, renderDashboard, renderHeader, showToast } from './ui.js?v=13';

async function init() {
  try {
    handleAuthCallback();
  } catch (err) {
    showToast(err.message, 'error');
  }

  if (!isLoggedIn()) {
    // Not logged in — go straight to GitHub login
    window.location.replace(`${WORKER_URL}/login`);
    return;
  }

  try {
    const user = await getUser();
    renderHeader(user);

    if (getConfig()) {
      await renderDashboard();
    } else {
      await renderSetup();
    }
  } catch (err) {
    showToast('Session expired. Please log in again.', 'error');
    window.location.replace('/');
  }
}

init();
