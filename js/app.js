import { isLoggedIn, handleAuthCallback, getToken } from './auth.js';
import { getUser } from './github.js';
import { getConfig } from './config.js';
import { renderLogin, renderSetup, renderDashboard, renderHeader, showToast } from './ui.js';

async function init() {
  try {
    handleAuthCallback();
  } catch (err) {
    showToast(err.message, 'error');
  }

  if (!isLoggedIn()) {
    renderHeader(null);
    renderLogin();
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
    renderHeader(null);
    renderLogin();
  }
}

init();
