import { login, logout, getToken } from './auth.js?v=5';
import { getUser, listRepos, listFiles, uploadFile, deleteFile, renameFile, getCdnUrl, getRawUrl, CDN_PROVIDERS, getCommits, getCommitDetail, getRawUrlAtCommit } from './github.js?v=5';
import { getConfig, saveConfig, clearConfig, autoDetectRepo, getRepoList, ASSETS_ROOT, getSavedRepos } from './config.js?v=5';
import { compressImage } from './compress.js?v=5';

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`;

let currentUser = null;
let currentPath = ASSETS_ROOT;
let allRepos = null;
let selectedFiles = new Set();

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const THEME_KEY = 'gitassets_theme';

function getTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function setTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// Apply saved theme on load
setTheme(getTheme());

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
          <button class="btn btn-sm" id="select-btn">Select</button>
          <button class="btn btn-sm" id="new-folder-btn">New folder</button>
          <button class="btn btn-sm" id="history-btn">History</button>
          <button class="btn btn-primary btn-sm" id="upload-btn">Upload</button>
        </div>
      </div>
      <div class="bulk-bar" id="bulk-bar" style="display:none;">
        <span id="bulk-count">0 selected</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" id="bulk-select-all">Select all</button>
          <button class="btn btn-sm btn-danger" id="bulk-delete">Delete selected</button>
          <button class="btn btn-sm" id="bulk-cancel">Cancel</button>
        </div>
      </div>
      <div class="filter-bar">
        <input type="text" id="search-input" class="filter-search" placeholder="Filter files..." />
        <select id="sort-select" class="filter-sort">
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="size-asc">Size small first</option>
          <option value="size-desc">Size large first</option>
        </select>
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
  setupHistoryButton(config);
  setupClipboardPaste();
  setupNewFolder(config);
  setupSelectMode(config);
  setupFilterSort(config);
  setupKeyboardShortcuts(config);
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

    currentFiles = files;

    // Apply search filter
    const query = ($('#search-input')?.value || '').toLowerCase();
    let filtered = query
      ? files.filter((f) => f.name.toLowerCase().includes(query))
      : [...files];

    // Sort
    const sortVal = $('#sort-select')?.value || 'name-asc';
    filtered.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      switch (sortVal) {
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        default: return a.name.localeCompare(b.name);
      }
    });

    if (filtered.length === 0 && query) {
      area.innerHTML = `<div class="empty-state"><p>No files matching "${escapeHtml(query)}"</p></div>`;
      return;
    }

    area.innerHTML = `<div class="file-grid" id="file-grid"></div>`;
    const grid = $('#file-grid');

    for (const file of filtered) {
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

  const checked = selectedFiles.has(file.path) ? 'checked' : '';
  const checkboxHtml = selectMode && !isDir
    ? `<label class="file-checkbox"><input type="checkbox" ${checked} data-path="${file.path}" /></label>`
    : '';

  card.innerHTML = `
    ${checkboxHtml}
    ${thumbHtml}
    <div class="file-info">
      <div class="file-name" title="${file.name}">${file.name}</div>
      ${sizeText ? `<div class="file-size">${sizeText}</div>` : ''}
    </div>
    ${!isDir && !selectMode ? `
    <div class="file-actions">
      <button class="btn-icon" title="Copy URL" data-action="copy-menu">&#128279;</button>
      <button class="btn-icon" title="Delete" data-action="delete" style="color:var(--danger);">&#128465;</button>
    </div>
    ` : ''}
  `;

  const checkbox = card.querySelector('input[type="checkbox"]');
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selectedFiles.add(file.path);
      else selectedFiles.delete(file.path);
      updateBulkCount();
    });
  }

  if (isDir) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      currentPath = file.path;
      renderBreadcrumbs();
      loadFiles(config);
    });
  }

  // Click to open URL panel (single click on image/thumb area)
  if (!isDir && !selectMode) {
    const thumbEl = card.querySelector('.file-thumb, .file-thumb-placeholder');
    if (thumbEl) {
      thumbEl.style.cursor = 'pointer';
      thumbEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showUrlPanel(file, config);
      });
    }
  }

  // Rename on double-click filename
  if (!isDir) {
    const nameEl = card.querySelector('.file-name');
    nameEl.style.cursor = 'pointer';
    nameEl.title = 'Double-click to rename';
    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRename(nameEl, file, config);
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

function showUrlPanel(file, config) {
  const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(file.name);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const urls = CDN_PROVIDERS.map((p) => ({
    name: p.name,
    url: p.url(config.owner, config.repo, config.branch, file.path),
  }));

  const primaryUrl = urls[0].url;
  const htmlSnippet = isImage ? `<img src="${primaryUrl}" alt="${file.name}" />` : `<a href="${primaryUrl}">${file.name}</a>`;
  const mdSnippet = isImage ? `![${file.name}](${primaryUrl})` : `[${file.name}](${primaryUrl})`;

  overlay.innerHTML = `
    <div class="modal url-panel">
      <div class="history-header">
        <h3>${file.name}</h3>
        <button class="btn-icon history-close">&times;</button>
      </div>
      ${isImage ? `<img class="url-panel-preview" src="${urls[1].url}" alt="${file.name}" />` : ''}
      <div class="url-panel-list">
        ${urls.map((u) => `
          <div class="url-panel-item">
            <span class="url-panel-label">${u.name}</span>
            <div class="url-panel-row">
              <code class="url-panel-url">${u.url}</code>
              <button class="btn btn-sm url-panel-copy" data-url="${u.url}">Copy</button>
            </div>
          </div>
        `).join('')}
        <div class="url-panel-item">
          <span class="url-panel-label">HTML</span>
          <div class="url-panel-row">
            <code class="url-panel-url">${escapeHtml(htmlSnippet)}</code>
            <button class="btn btn-sm url-panel-copy" data-url="${htmlSnippet}">Copy</button>
          </div>
        </div>
        <div class="url-panel-item">
          <span class="url-panel-label">Markdown</span>
          <div class="url-panel-row">
            <code class="url-panel-url">${escapeHtml(mdSnippet)}</code>
            <button class="btn btn-sm url-panel-copy" data-url="${mdSnippet}">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.history-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.url-panel-copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      copyToClipboard(btn.dataset.url);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
  });
}

function startRename(nameEl, file, config) {
  const oldName = file.name;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldName;
  input.className = 'rename-input';
  nameEl.replaceWith(input);
  input.focus();
  // Select name without extension
  const dotIdx = oldName.lastIndexOf('.');
  input.setSelectionRange(0, dotIdx > 0 ? dotIdx : oldName.length);

  const finish = async () => {
    const newName = input.value.trim();
    const newEl = document.createElement('div');
    newEl.className = 'file-name';
    newEl.style.cursor = 'pointer';
    newEl.textContent = newName || oldName;
    newEl.title = 'Double-click to rename';
    input.replaceWith(newEl);
    newEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRename(newEl, file, config);
    });

    if (!newName || newName === oldName) return;

    const dir = file.path.substring(0, file.path.lastIndexOf('/'));
    const newPath = dir ? `${dir}/${newName}` : newName;

    try {
      await renameFile(config.owner, config.repo, file.path, newPath);
      showToast(`Renamed to ${newName}`);
      await loadFiles(config);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = oldName; input.blur(); }
  });
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

// ── New Folder ──

function setupNewFolder(config) {
  $('#new-folder-btn').addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>New folder</h3>
        <input type="text" id="folder-name-input" class="staging-input" placeholder="Folder name" style="width:100%;margin:12px 0;" />
        <div class="modal-actions">
          <button class="btn btn-sm" id="folder-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="folder-create">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#folder-name-input');
    input.focus();

    const create = async () => {
      const name = input.value.trim().replace(/[^a-zA-Z0-9_\-. ]/g, '');
      if (!name) { showToast('Enter a folder name', 'error'); return; }
      overlay.remove();
      try {
        const path = `${currentPath}/${name}/.gitkeep`;
        await uploadFile(config.owner, config.repo, path, btoa(''), `Create folder ${name}`);
        showToast(`Created folder ${name}`);
        await loadFiles(config);
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    overlay.querySelector('#folder-create').addEventListener('click', create);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });
    overlay.querySelector('#folder-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  });
}

// ── Keyboard Shortcuts ──

function setupKeyboardShortcuts(config) {
  document.addEventListener('keydown', (e) => {
    // Don't trigger in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Escape — close modals
    if (e.key === 'Escape') {
      const modal = $('.modal-overlay');
      if (modal) { modal.remove(); return; }
      // Exit select mode
      if (selectMode) {
        selectMode = false;
        selectedFiles.clear();
        $('#select-btn').textContent = 'Select';
        $('#bulk-bar').style.display = 'none';
        loadFiles(config);
      }
    }

    // Delete — delete selected files in select mode
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectMode && selectedFiles.size > 0) {
      e.preventDefault();
      $('#bulk-delete').click();
    }

    // / — focus search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const search = $('#search-input');
      if (search) search.focus();
    }
  });
}

// ── Filter & Sort ──

function setupFilterSort(config) {
  let debounce;
  $('#search-input').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderFileGrid(config), 150);
  });
  $('#sort-select').addEventListener('change', () => renderFileGrid(config));
}

function renderFileGrid(config) {
  if (currentFiles.length === 0) return;
  const area = $('#file-area');
  const query = ($('#search-input')?.value || '').toLowerCase();
  let filtered = query
    ? currentFiles.filter((f) => f.name.toLowerCase().includes(query))
    : [...currentFiles];

  const sortVal = $('#sort-select')?.value || 'name-asc';
  filtered.sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    switch (sortVal) {
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'size-asc': return (a.size || 0) - (b.size || 0);
      case 'size-desc': return (b.size || 0) - (a.size || 0);
      default: return a.name.localeCompare(b.name);
    }
  });

  if (filtered.length === 0 && query) {
    area.innerHTML = `<div class="empty-state"><p>No files matching "${escapeHtml(query)}"</p></div>`;
    return;
  }

  area.innerHTML = `<div class="file-grid" id="file-grid"></div>`;
  const grid = $('#file-grid');
  for (const file of filtered) {
    grid.appendChild(createFileCard(file, config));
  }
}

// ── Select Mode ──

let selectMode = false;
let currentFiles = [];

function setupSelectMode(config) {
  $('#select-btn').addEventListener('click', () => {
    selectMode = !selectMode;
    selectedFiles.clear();
    $('#select-btn').textContent = selectMode ? 'Cancel select' : 'Select';
    $('#bulk-bar').style.display = selectMode ? 'flex' : 'none';
    updateBulkCount();
    // Re-render to show/hide checkboxes
    loadFiles(config);
  });

  $('#bulk-cancel').addEventListener('click', () => {
    selectMode = false;
    selectedFiles.clear();
    $('#select-btn').textContent = 'Select';
    $('#bulk-bar').style.display = 'none';
    loadFiles(config);
  });

  $('#bulk-select-all').addEventListener('click', () => {
    const allFiles = currentFiles.filter((f) => f.type !== 'dir');
    if (selectedFiles.size === allFiles.length) {
      selectedFiles.clear();
    } else {
      allFiles.forEach((f) => selectedFiles.add(f.path));
    }
    updateBulkCount();
    loadFiles(config);
  });

  $('#bulk-delete').addEventListener('click', () => {
    if (selectedFiles.size === 0) return;
    const count = selectedFiles.size;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>Delete ${count} file${count > 1 ? 's' : ''}</h3>
        <p>Are you sure? This cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn btn-sm" id="modal-cancel">Cancel</button>
          <button class="btn btn-sm btn-danger" id="modal-confirm">Delete ${count} file${count > 1 ? 's' : ''}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#modal-confirm').addEventListener('click', async () => {
      overlay.remove();
      const paths = [...selectedFiles];
      let done = 0;
      for (const path of paths) {
        const file = currentFiles.find((f) => f.path === path);
        if (!file) continue;
        try {
          await deleteFile(config.owner, config.repo, file.path, file.sha);
          done++;
        } catch (err) {
          showToast(`Failed to delete ${file.name}: ${err.message}`, 'error');
        }
      }
      showToast(`Deleted ${done} file${done > 1 ? 's' : ''}`);
      selectedFiles.clear();
      selectMode = false;
      $('#select-btn').textContent = 'Select';
      $('#bulk-bar').style.display = 'none';
      await loadFiles(config);
    });
  });
}

function updateBulkCount() {
  const el = $('#bulk-count');
  if (el) el.textContent = `${selectedFiles.size} selected`;
}

// ── Staging & Upload ──

let stagedFiles = [];

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
    stageFiles(e.dataTransfer.files);
  });

  dz.addEventListener('click', () => $('#file-input').click());
}

function setupUploadButton(config) {
  const input = $('#file-input');
  $('#upload-btn').addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length > 0) {
      stageFiles(input.files);
      input.value = '';
    }
  });
}

async function stageFiles(fileList) {
  const files = Array.from(fileList);
  for (const file of files) {
    const isDuplicate = stagedFiles.some((s) => s.file.name === file.name && s.file.size === file.size);
    if (isDuplicate) continue;

    const result = await compressImage(file);
    stagedFiles.push({
      file: result.file,
      originalFile: result.converted ? file : null,
      preview: URL.createObjectURL(result.file),
      converted: result.converted,
      originalSize: result.originalSize,
      savings: result.savings,
    });
    renderStagingArea();
  }
}

function renderStagingArea() {
  let area = $('#staging-area');
  if (!area) {
    const container = $('.dashboard');
    area = document.createElement('div');
    area.id = 'staging-area';
    area.className = 'staging-area';
    // Insert before file-area
    const fileArea = $('#file-area');
    container.insertBefore(area, fileArea);
  }

  if (stagedFiles.length === 0) {
    area.remove();
    return;
  }

  const totalSize = stagedFiles.reduce((sum, s) => sum + s.file.size, 0);

  area.innerHTML = `
    <div class="staging-header">
      <h3>Staged files (${stagedFiles.length})</h3>
      <span class="staging-size">${formatSize(totalSize)}</span>
    </div>
    <div class="staging-grid" id="staging-grid"></div>
    <div class="staging-commit">
      <input type="text" id="commit-msg" class="staging-input" placeholder="Commit message (optional)" />
      <div class="staging-actions">
        <button class="btn btn-sm" id="staging-clear">Clear all</button>
        <button class="btn btn-primary btn-sm" id="staging-commit">Commit ${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''}</button>
      </div>
    </div>
  `;

  const grid = $('#staging-grid');
  stagedFiles.forEach((staged, i) => {
    const isImage = staged.file.type.startsWith('image/');
    const card = document.createElement('div');
    card.className = 'staging-card';
    const savingsHtml = staged.converted
      ? `<span class="staging-savings">-${staged.savings}% (was ${formatSize(staged.originalSize)})</span>`
      : '';

    card.innerHTML = `
      ${isImage ? `<img class="staging-thumb" src="${staged.preview}" />` : `<div class="staging-thumb-placeholder">&#128196;</div>`}
      <div class="staging-info">
        <span class="staging-name" title="${staged.file.name}">${staged.file.name}</span>
        <span class="staging-file-size">${formatSize(staged.file.size)} ${savingsHtml}</span>
      </div>
      <button class="btn-icon staging-remove" data-index="${i}" title="Remove">&times;</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.staging-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      URL.revokeObjectURL(stagedFiles[idx].preview);
      stagedFiles.splice(idx, 1);
      renderStagingArea();
    });
  });

  $('#staging-clear').addEventListener('click', () => {
    stagedFiles.forEach((s) => URL.revokeObjectURL(s.preview));
    stagedFiles = [];
    renderStagingArea();
  });

  $('#staging-commit').addEventListener('click', () => {
    const msg = $('#commit-msg').value.trim();
    commitStagedFiles(msg);
  });

  $('#commit-msg').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const msg = $('#commit-msg').value.trim();
      commitStagedFiles(msg);
    }
  });
}

async function commitStagedFiles(message) {
  const config = getConfig();
  if (!config || stagedFiles.length === 0) return;

  const files = [...stagedFiles];
  const defaultMsg = files.length === 1
    ? `Upload ${files[0].file.name}`
    : `Upload ${files.length} files`;

  const bar = $('#upload-bar');
  const fill = $('#upload-fill');
  const status = $('#upload-status');
  bar.classList.add('visible');

  let done = 0;
  for (const staged of files) {
    status.textContent = `Uploading ${staged.file.name} (${done + 1}/${files.length})...`;
    fill.style.width = `${(done / files.length) * 100}%`;

    try {
      const base64 = await fileToBase64(staged.file);
      const path = currentPath ? `${currentPath}/${staged.file.name}` : staged.file.name;
      const commitMsg = files.length === 1
        ? (message || defaultMsg)
        : `${message || defaultMsg} [${done + 1}/${files.length}]`;
      await uploadFile(config.owner, config.repo, path, base64, commitMsg);
      URL.revokeObjectURL(staged.preview);
      done++;
    } catch (err) {
      showToast(`Failed to upload ${staged.file.name}: ${err.message}`, 'error');
    }
  }

  fill.style.width = '100%';
  status.textContent = `Uploaded ${done}/${files.length} files`;
  setTimeout(() => {
    bar.classList.remove('visible');
    fill.style.width = '0%';
  }, 2000);

  stagedFiles = [];
  renderStagingArea();
  await loadFiles(config);
}

function setupClipboardPaste() {
  document.addEventListener('paste', (e) => {
    // Don't capture paste in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const files = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Generate timestamped name for clipboard images
          const ext = file.type.split('/')[1] || 'png';
          const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const named = new File([file], `paste-${ts}.${ext}`, { type: file.type });
          files.push(named);
        }
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      stageFiles(files);
      showToast(`Pasted ${files.length} file${files.length > 1 ? 's' : ''} to staging`);
    }
  });
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
    showRepoSwitcher();
  });
}

function showRepoSwitcher() {
  document.querySelectorAll('.cdn-menu').forEach((m) => m.remove());

  const config = getConfig();
  const saved = getSavedRepos();
  const menu = document.createElement('div');
  menu.className = 'cdn-menu repo-menu';

  const currentKey = config ? `${config.owner}/${config.repo}` : '';

  let html = saved
    .map((r) => {
      const key = `${r.owner}/${r.repo}`;
      const active = key === currentKey ? ' repo-menu-active' : '';
      return `<button class="cdn-menu-item${active}" data-owner="${r.owner}" data-repo="${r.repo}" data-branch="${r.branch}">${key}</button>`;
    })
    .join('');

  html += `<div style="border-top:1px solid var(--border);margin:4px 0;"></div>`;
  html += `<button class="cdn-menu-item" data-action="add-new">+ Add repository</button>`;

  menu.innerHTML = html;

  const btn = $('#change-repo-btn');
  const rect = btn.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.right = `${window.innerWidth - rect.right}px`;
  document.body.appendChild(menu);

  menu.querySelectorAll('.cdn-menu-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();

      if (item.dataset.action === 'add-new') {
        clearConfig();
        currentPath = ASSETS_ROOT;
        allRepos = null;
        renderSetup();
        return;
      }

      const newConfig = {
        owner: item.dataset.owner,
        repo: item.dataset.repo,
        branch: item.dataset.branch,
      };
      saveConfig(newConfig);
      currentPath = ASSETS_ROOT;
      renderDashboard();
    });
  });

  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', close);
    }
  };
  setTimeout(() => document.addEventListener('click', close), 0);
}

// ── History ──

function setupHistoryButton(config) {
  $('#history-btn').addEventListener('click', () => showHistory(config));
}

async function showHistory(config) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal history-modal">
      <div class="history-header">
        <h3>Asset History</h3>
        <button class="btn-icon history-close">&times;</button>
      </div>
      <div class="history-content">
        <div style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.history-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  try {
    const commits = await getCommits(config.owner, config.repo, currentPath);
    const content = overlay.querySelector('.history-content');

    if (commits.length === 0) {
      content.innerHTML = `<div class="empty-state"><p>No history for this path.</p></div>`;
      return;
    }

    content.innerHTML = `<div class="history-timeline" id="history-timeline"></div>
      <button class="btn btn-sm history-load-more" id="history-more" style="display:none;margin-top:12px;width:100%;">Load more</button>`;

    let page = 1;
    renderCommits(commits, config, overlay);

    const moreBtn = overlay.querySelector('#history-more');
    if (commits.length === 30) moreBtn.style.display = 'block';

    moreBtn.addEventListener('click', async () => {
      page++;
      moreBtn.textContent = 'Loading...';
      try {
        const more = await getCommits(config.owner, config.repo, currentPath, page);
        renderCommits(more, config, overlay);
        if (more.length < 30) moreBtn.style.display = 'none';
        else moreBtn.textContent = 'Load more';
      } catch (err) {
        showToast(err.message, 'error');
        moreBtn.textContent = 'Load more';
      }
    });
  } catch (err) {
    overlay.querySelector('.history-content').innerHTML =
      `<div class="empty-state"><p style="color:var(--danger);">Error: ${err.message}</p></div>`;
  }
}

async function renderCommits(commits, config, overlay) {
  const timeline = overlay.querySelector('#history-timeline');

  for (const commit of commits) {
    const date = new Date(commit.commit.author.date);
    const timeStr = date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const entry = document.createElement('div');
    entry.className = 'history-entry';
    entry.innerHTML = `
      <div class="history-meta">
        <span class="history-date">${timeStr}</span>
        <span class="history-author">${commit.commit.author.name}</span>
      </div>
      <div class="history-message">${escapeHtml(commit.commit.message)}</div>
      <div class="history-files" data-sha="${commit.sha}">
        <button class="btn btn-sm history-expand">Show files</button>
      </div>
    `;

    const filesDiv = entry.querySelector('.history-files');
    const expandBtn = entry.querySelector('.history-expand');

    expandBtn.addEventListener('click', async () => {
      if (expandBtn.dataset.loaded) {
        const list = filesDiv.querySelector('.history-file-list');
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
        expandBtn.textContent = list.style.display === 'none' ? 'Show files' : 'Hide files';
        return;
      }

      expandBtn.textContent = 'Loading...';
      try {
        const detail = await getCommitDetail(config.owner, config.repo, commit.sha);
        const assetFiles = detail.files.filter((f) => f.filename.startsWith(currentPath));

        if (assetFiles.length === 0) {
          expandBtn.textContent = 'No asset changes';
          return;
        }

        const list = document.createElement('div');
        list.className = 'history-file-list';

        for (const file of assetFiles) {
          const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(file.filename);
          const statusClass = file.status === 'removed' ? 'deleted' : file.status === 'added' ? 'added' : 'modified';
          const statusLabel = file.status === 'removed' ? 'deleted' : file.status;

          const item = document.createElement('div');
          item.className = `history-file ${statusClass}`;

          let thumbHtml = '';
          if (isImage) {
            const imgUrl = file.status === 'removed'
              ? getRawUrlAtCommit(config.owner, config.repo, detail.parents[0]?.sha || commit.sha, file.filename)
              : getRawUrlAtCommit(config.owner, config.repo, commit.sha, file.filename);
            thumbHtml = `<img class="history-thumb" src="${imgUrl}" alt="${file.filename}" loading="lazy" />`;
          }

          item.innerHTML = `
            ${thumbHtml}
            <div class="history-file-info">
              <span class="history-filename">${file.filename.split('/').pop()}</span>
              <span class="history-status history-status-${statusClass}">${statusLabel}</span>
            </div>
          `;
          list.appendChild(item);
        }

        filesDiv.appendChild(list);
        expandBtn.textContent = 'Hide files';
        expandBtn.dataset.loaded = 'true';
      } catch (err) {
        expandBtn.textContent = 'Failed to load';
      }
    });

    timeline.appendChild(entry);
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
      <button class="btn btn-sm btn-icon" id="theme-btn" title="Toggle theme">${getTheme() === 'dark' ? '&#9728;' : '&#9790;'}</button>
      <button class="btn btn-sm" id="logout-btn">Logout</button>
    </div>
  `;
  $('#theme-btn').addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    $('#theme-btn').innerHTML = next === 'dark' ? '&#9728;' : '&#9790;';
  });
  $('#logout-btn').addEventListener('click', () => {
    clearConfig();
    logout();
  });
}
