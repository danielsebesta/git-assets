import { isLoggedIn, handleAuthCallback, getToken } from './auth.js?v=10';
import { getUser } from './github.js?v=10';
import { getConfig } from './config.js?v=10';
import { renderLogin, renderSetup, renderDashboard, renderHeader, showToast } from './ui.js?v=10';

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
