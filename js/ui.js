import { login, logout, getToken } from './auth.js';
import { getUser, listRepos, listFiles, uploadFile, deleteFile, getCdnUrl, getRawUrl, CDN_PROVIDERS } from './github.js';
import { getConfig, saveConfig, clearConfig, autoDetectRepo, getRepoList, ASSETS_ROOT } from './config.js';

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`;

let currentUser = null;
let currentPath = ASSETS_ROOT;
let allRepos = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

export function showToast(msg, type = 'success') {
  const existing = $('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Login Screen ──

export function renderLogin() {
  $('#app').innerHTML = `
    <div class="login-screen">
      <h1>GitAssets</h1>
      <p>Turn your GitHub repository into a free CDN for images and static assets.</p>
      <button class="btn btn-github" id="login-btn">
        ${GITHUB_ICON} Sign in with GitHub
      </button>
    </div>
  `;
  $('#login-btn').addEventListener('click', login);
}

// ── Setup Wizard ──

export async function renderSetup() {
  const app = $('#app');
  app.innerHTML = `
    <div class="setup-screen">
      <h2>Choose your repository</h2>
      <p>Select the repository where your assets will be stored.</p>
      <div class="setup-detecting"><span class="spinner"></span> Looking for your repos...</div>
    </div>
  `;

  try {
    currentUser = currentUser || await getUser();
    const detected = await autoDetectRepo(currentUser.login);

    if (detected) {
      saveConfig(detected);
      showToast(`Auto-detected ${detected.owner}/${detected.repo}`);
      await renderDashboard();
      return;
    }

    allRepos = allRepos || await listRepos();
    const pushable = getRepoList(allRepos);

    const container = app.querySelector('.setup-screen');
    container.innerHTML = `
      <h2>Choose your repository</h2>
      <p>No fork of git-assets found. Pick a repo to store your assets, or enter one manually.</p>
      <ul class="setup-repo-list" id="repo-list"></ul>
      <div class="setup-manual">
        <input type="text" id="manual-repo" placeholder="owner/repo (e.g. myname/my-assets)" />
        <button class="btn btn-primary btn-sm" id="manual-btn">Use</button>
      </div>
    `;

    const list = $('#repo-list');
    pushable.slice(0, 50).forEach((r) => {
      const li = document.createElement('li');
      li.className = 'setup-repo-item';
      li.textContent = r.fullName;
      li.addEventListener('click', () => {
        saveConfig({ owner: r.owner, repo: r.repo, branch: r.branch });
        renderDashboard();
      });
      list.appendChild(li);
    });

    $('#manual-btn').addEventListener('click', () => {
      const val = $('#manual-repo').value.trim();
      const parts = val.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        showToast('Enter as owner/repo', 'error');
        return;
      }
      saveConfig({ owner: parts[0], repo: parts[1], branch: 'main' });
      renderDashboard();
    });

    $('#manual-repo').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('#manual-btn').click();
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Dashboard ──

export async function renderDashboard() {
  const config = getConfig();
  if (!config) return renderSetup();

  currentUser = currentUser || await getUser();

  $('#app').innerHTML = `
    <div class="dashboard">
      <div class="toolbar">
        <div class="breadcrumbs" id="breadcrumbs"></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-sm" id="change-repo-btn" title="Change repository">${config.owner}/${config.repo}</button>
          <button class="btn btn-primary btn-sm" id="upload-btn">Upload</button>
        </div>
      </div>
      <div class="dropzone" id="dropzone">
        <div class="dropzone-text">Drop files here to upload</div>
        <div class="dropzone-hint">or click Upload / use the button above</div>
      </div>
      <div id="file-area">
        <div style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    </div>
    <div class="upload-bar" id="upload-bar">
      <span id="upload-status">Uploading...</span>
      <div class="upload-bar-progress"><div class="upload-bar-fill" id="upload-fill"></div></div>
    </div>
    <input type="file" id="file-input" multiple hidden />
  `;

  renderBreadcrumbs();
  setupDropzone(config);
  setupUploadButton(config);
  setupChangeRepo();
  await loadFiles(config);
}

function renderBreadcrumbs() {
  const bc = $('#breadcrumbs');
  // Show path relative to _assets root
  const relative = currentPath.startsWith(ASSETS_ROOT)
    ? currentPath.slice(ASSETS_ROOT.length).replace(/^\//, '')
    : currentPath;
  const parts = relative.split('/').filter(Boolean);

  let html = `<a data-path="${ASSETS_ROOT}">assets</a>`;
  let accumulated = ASSETS_ROOT;
  for (const part of parts) {
    accumulated += '/' + part;
    html += `<span class="sep">/</span><a data-path="${accumulated}">${part}</a>`;
  }
  bc.innerHTML = html;

  bc.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      currentPath = a.dataset.path;
      const config = getConfig();
      renderBreadcrumbs();
      loadFiles(config);
    });
  });
}

async function loadFiles(config) {
  const area = $('#file-area');
  area.innerHTML = `<div style="text-align:center;padding:40px;"><span class="spinner"></span></div>`;

  try {
    const files = await listFiles(config.owner, config.repo, currentPath);

    if (files.length === 0) {
      area.innerHTML = `
        <div class="empty-state">
          <p>No files yet</p>
          <p>Upload your first asset using drag & drop or the upload button.</p>
        </div>
      `;
      return;
    }

    // Sort: folders first, then files
    files.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });

    area.innerHTML = `<div class="file-grid" id="file-grid"></div>`;
    const grid = $('#file-grid');

    for (const file of files) {
      grid.appendChild(createFileCard(file, config));
    }
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><p style="color:var(--danger);">Error: ${err.message}</p></div>`;
  }
}

function createFileCard(file, config) {
  const card = document.createElement('div');
  card.className = 'file-card';

  const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(file.name);
  const isDir = file.type === 'dir';

  let thumbHtml;
  if (isDir) {
    thumbHtml = `<div class="file-thumb-placeholder"><span class="folder-icon">&#128193;</span></div>`;
  } else if (isImage) {
    const thumbUrl = getRawUrl(config.owner, config.repo, config.branch, file.path);
    thumbHtml = `<img class="file-thumb" src="${thumbUrl}" alt="${file.name}" loading="lazy" />`;
  } else {
    thumbHtml = `<div class="file-thumb-placeholder">&#128196;</div>`;
  }

  const sizeText = file.size ? formatSize(file.size) : '';

  card.innerHTML = `
    ${thumbHtml}
    <div class="file-info">
      <div class="file-name" title="${file.name}">${file.name}</div>
      ${sizeText ? `<div class="file-size">${sizeText}</div>` : ''}
    </div>
    ${!isDir ? `
    <div class="file-actions">
      <button class="btn-icon" title="Copy URL" data-action="copy-menu">&#128279;</button>
      <button class="btn-icon" title="Delete" data-action="delete" style="color:var(--danger);">&#128465;</button>
    </div>
    ` : ''}
  `;

  if (isDir) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      currentPath = file.path;
      renderBreadcrumbs();
      loadFiles(config);
    });
  }

  card.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      if (action === 'copy-menu') {
        showCdnMenu(btn, file, config);
      } else if (action === 'delete') {
        showDeleteModal(file, config);
      }
    });
  });

  return card;
}

function showCdnMenu(anchor, file, config) {
  // Remove any existing menu
  document.querySelectorAll('.cdn-menu').forEach((m) => m.remove());

  const menu = document.createElement('div');
  menu.className = 'cdn-menu';
  menu.innerHTML = CDN_PROVIDERS.map(
    (p) => `<button class="cdn-menu-item" data-provider="${p.id}">${p.name}</button>`
  ).join('');

  // Position near the button
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  document.body.appendChild(menu);

  menu.querySelectorAll('.cdn-menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const provider = CDN_PROVIDERS.find((p) => p.id === item.dataset.provider);
      const url = provider.url(config.owner, config.repo, config.branch, file.path);
      copyToClipboard(url);
      showToast(`${provider.name} URL copied!`);
      menu.remove();
    });
  });

  // Close on outside click
  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

function showDeleteModal(file, config) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>Delete file</h3>
      <p>Are you sure you want to delete <strong>${file.name}</strong>? This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-sm" id="modal-cancel">Cancel</button>
        <button class="btn btn-sm btn-danger" id="modal-confirm">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
    overlay.remove();
    try {
      await deleteFile(config.owner, config.repo, file.path, file.sha);
      showToast(`Deleted ${file.name}`);
      await loadFiles(config);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ── Upload Logic ──

function setupDropzone(config) {
  const dz = $('#dropzone');

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('active');
  });

  dz.addEventListener('dragleave', () => dz.classList.remove('active'));

  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('active');
    handleFiles(e.dataTransfer.files, config);
  });

  dz.addEventListener('click', () => $('#file-input').click());
}

function setupUploadButton(config) {
  const input = $('#file-input');
  $('#upload-btn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      handleFiles(input.files, config);
      input.value = '';
    }
  });
}

async function handleFiles(fileList, config) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  const bar = $('#upload-bar');
  const fill = $('#upload-fill');
  const status = $('#upload-status');
  bar.classList.add('visible');

  let done = 0;
  for (const file of files) {
    status.textContent = `Uploading ${file.name} (${done + 1}/${files.length})...`;
    fill.style.width = `${(done / files.length) * 100}%`;

    try {
      const base64 = await fileToBase64(file);
      const path = currentPath ? `${currentPath}/${file.name}` : file.name;
      await uploadFile(config.owner, config.repo, path, base64, `Upload ${file.name}`);
      done++;
    } catch (err) {
      showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }

  fill.style.width = '100%';
  status.textContent = `Uploaded ${done}/${files.length} files`;
  setTimeout(() => {
    bar.classList.remove('visible');
    fill.style.width = '0%';
  }, 2000);

  await loadFiles(config);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Remove data:...;base64, prefix
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupChangeRepo() {
  $('#change-repo-btn').addEventListener('click', () => {
    clearConfig();
    currentPath = ASSETS_ROOT;
    allRepos = null;
    renderSetup();
  });
}

// ── Helpers ──

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Header ──

export function renderHeader(user) {
  const header = $('#header');
  if (!user) {
    header.innerHTML = `<a class="header-logo" href="#">GitAssets</a><div></div>`;
    return;
  }
  header.innerHTML = `
    <a class="header-logo" href="#">GitAssets</a>
    <div class="header-right">
      <span class="header-user">
        <img class="header-avatar" src="${user.avatar_url}" alt="${user.login}" />
        ${user.login}
      </span>
      <button class="btn btn-sm" id="logout-btn">Logout</button>
    </div>
  `;
  $('#logout-btn').addEventListener('click', () => {
    clearConfig();
    logout();
  });
}
