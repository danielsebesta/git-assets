import { login, logout, getToken } from './auth.js?v=9';
import { getUser, listRepos, listFiles, uploadFile, deleteFile, renameFile, batchUpload, getRepoInfo, MAX_FILE_SIZE, getCdnUrl, getRawUrl, CDN_PROVIDERS, getCommits, getCommitDetail, getRawUrlAtCommit } from './github.js?v=9';
import { getConfig, saveConfig, clearConfig, autoDetectRepo, getRepoList, ASSETS_ROOT, getSavedRepos, toggleFavorite, isFavorite, getFavorites, addRecent, getRecent } from './config.js?v=9';
import { compressImage } from './compress.js?v=9';
import { initSelection, setFiles, getSelected, clearSelection, selectAll, isSelected, handleClick as selectionClick } from './selection.js?v=9';

const GITHUB_ICON = `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`;

let currentUser = null;
let currentPath = ASSETS_ROOT;
let allRepos = null;

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
          <div class="storage-bar" id="storage-bar" title="Repository storage">
            <div class="storage-bar-fill" id="storage-fill"></div>
            <span class="storage-label" id="storage-label"></span>
          </div>
          <button class="btn btn-sm" id="stats-btn">Stats</button>
          <button class="btn btn-sm" id="new-folder-btn">New folder</button>
          <button class="btn btn-sm" id="history-btn">History</button>
          <button class="btn btn-primary btn-sm" id="upload-btn">Upload</button>
        </div>
      </div>
      <div class="bulk-bar" id="bulk-bar" style="display:none;">
        <span id="bulk-count">0 selected</span>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-sm" id="bulk-select-all">Select all</button>
          <button class="btn btn-sm" id="bulk-copy">Copy URLs</button>
          <button class="btn btn-sm btn-danger" id="bulk-delete">Delete</button>
          <button class="btn btn-sm" id="bulk-clear">Clear</button>
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
  setupSelectionBar(config);
  setupFilterSort(config);
  setupKeyboardShortcuts(config);
  initSelection((sel) => onSelectionChange(sel, config));
  setupContextMenu(config);
  setupStatsButton(config);
  await loadFiles(config);
  loadRepoSize(config);
  renderRecentUploads(config);
  showWalkthrough();
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

    // Apply search filter
    const query = ($('#search-input')?.value || '').toLowerCase();
    let filtered = query
      ? files.filter((f) => f.name.toLowerCase().includes(query))
      : [...files];

    // Sort: pinned first, then folders, then by chosen sort
    const favs = getFavorites();
    const sortVal = $('#sort-select')?.value || 'name-asc';
    filtered.sort((a, b) => {
      const aFav = favs.includes(a.path) ? 1 : 0;
      const bFav = favs.includes(b.path) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      switch (sortVal) {
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'size-asc': return (a.size || 0) - (b.size || 0);
        case 'size-desc': return (b.size || 0) - (a.size || 0);
        default: return a.name.localeCompare(b.name);
      }
    });

    currentFiles = filtered;
    setFiles(filtered);

    if (filtered.length === 0 && query) {
      area.innerHTML = `<div class="empty-state"><p>No files matching "${escapeHtml(query)}"</p></div>`;
      return;
    }

    area.innerHTML = `<div class="file-grid" id="file-grid"></div>`;
    const grid = $('#file-grid');

    filtered.forEach((file, idx) => {
      grid.appendChild(createFileCard(file, config, idx));
    });
  } catch (err) {
    area.innerHTML = `<div class="empty-state"><p style="color:var(--danger);">Error: ${err.message}</p></div>`;
  }
}

function createFileCard(file, config, index) {
  const card = document.createElement('div');
  card.className = 'file-card';
  if (isSelected(file.path)) card.classList.add('selected');

  const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(file.name);
  const isDir = file.type === 'dir';

  if (!isDir) card.dataset.path = file.path;

  let thumbHtml;
  if (isDir) {
    thumbHtml = `<div class="file-thumb-placeholder"><span class="folder-icon">&#128193;</span></div>`;
  } else if (isImage) {
    const thumbUrl = getRawUrl(config.owner, config.repo, config.branch, file.path);
    thumbHtml = `<img class="file-thumb" src="${thumbUrl}" alt="${file.name}" loading="lazy" /><div class="hover-preview"><img src="${thumbUrl}" alt="${file.name}" /></div>`;
  } else {
    thumbHtml = `<div class="file-thumb-placeholder">&#128196;</div>`;
  }

  const sizeText = file.size ? formatSize(file.size) : '';

  card.innerHTML = `
    ${thumbHtml}
    <div class="file-info">
      <div class="file-name" title="${file.name}">${isFavorite(file.path) ? '<span class="pin-icon">&#128204;</span> ' : ''}${file.name}</div>
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
      clearSelection();
      renderBreadcrumbs();
      loadFiles(config);
    });

    // Folder is a drop target for moving files
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drag-over');
      const paths = JSON.parse(e.dataTransfer.getData('text/plain') || '[]');
      if (paths.length === 0) return;
      let moved = 0;
      for (const oldPath of paths) {
        const fname = oldPath.split('/').pop();
        const newPath = `${file.path}/${fname}`;
        try {
          await renameFile(config.owner, config.repo, oldPath, newPath, `Move ${fname} to ${file.name}/`);
          moved++;
        } catch (err) {
          showToast(`Failed to move ${fname}: ${err.message}`, 'error');
        }
      }
      if (moved > 0) {
        showToast(`Moved ${moved} file${moved > 1 ? 's' : ''} to ${file.name}/`);
        clearSelection();
        await loadFiles(config);
      }
    });
  } else {
    // Make files draggable for moving into folders
    card.draggable = true;
    card.addEventListener('dragstart', (e) => {
      const sel = getSelected();
      const paths = sel.size > 0 && sel.has(file.path)
        ? [...sel]
        : [file.path];
      e.dataTransfer.setData('text/plain', JSON.stringify(paths));
      e.dataTransfer.effectAllowed = 'move';
    });

    // Click to select (OS-style: click, shift+click, ctrl+click)
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]') || e.target.closest('.rename-input')) return;
      selectionClick(file.path, index, e);
    });

    // Double-click on thumbnail opens URL panel
    const thumbEl = card.querySelector('.file-thumb, .file-thumb-placeholder');
    if (thumbEl) {
      thumbEl.style.cursor = 'pointer';
      thumbEl.addEventListener('dblclick', (e) => {
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

// ── Context Menu ──

function setupContextMenu(config) {
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.file-card[data-path]');
    if (!card) return;
    e.preventDefault();

    const path = card.dataset.path;
    const file = currentFiles.find((f) => f.path === path);
    if (!file) return;

    // If right-clicked file is not in selection, select only it
    const sel = getSelected();
    if (!sel.has(path)) {
      clearSelection();
      selectionClick(path, currentFiles.indexOf(file), { ctrlKey: false, shiftKey: false, metaKey: false });
    }

    showContextMenu(e.pageX, e.pageY, file, config);
  });
}

function showContextMenu(x, y, file, config) {
  document.querySelectorAll('.context-menu').forEach((m) => m.remove());

  const sel = getSelected();
  const multi = sel.size > 1;
  const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(file.name);

  const items = [
    { label: multi ? `Copy ${sel.size} URLs (jsDelivr)` : 'Copy jsDelivr URL', action: 'copy-jsdelivr' },
    { label: 'Copy all CDN URLs', action: 'copy-all' },
    { label: 'Copy HTML snippet', action: 'copy-html' },
    { label: 'Copy Markdown snippet', action: 'copy-md' },
    { divider: true },
    { label: 'Open URL panel', action: 'url-panel', hidden: multi },
    { label: 'Open in new tab', action: 'open-tab', hidden: multi },
    { label: 'Download', action: 'download', hidden: multi },
    { divider: true },
    { label: 'Rename', action: 'rename', hidden: multi },
    { label: `Batch rename (${sel.size})`, action: 'batch-rename', hidden: !multi },
    { label: isFavorite(file.path) ? 'Unpin' : 'Pin to top', action: 'toggle-fav', hidden: multi },
    { label: multi ? `Delete ${sel.size} files` : 'Delete', action: 'delete', danger: true },
  ].filter((i) => !i.hidden);

  const menu = document.createElement('div');
  menu.className = 'context-menu';

  for (const item of items) {
    if (item.divider) {
      menu.innerHTML += `<div class="context-divider"></div>`;
      continue;
    }
    const cls = item.danger ? ' context-item-danger' : '';
    menu.innerHTML += `<button class="context-item${cls}" data-action="${item.action}">${item.label}</button>`;
  }

  // Position — keep on screen
  menu.style.top = `${y}px`;
  menu.style.left = `${x}px`;
  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;

  menu.querySelectorAll('.context-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      handleContextAction(btn.dataset.action, file, config);
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

function handleContextAction(action, file, config) {
  const sel = getSelected();
  const paths = sel.size > 0 ? [...sel] : [file.path];

  switch (action) {
    case 'copy-jsdelivr': {
      const urls = paths.map((p) => getCdnUrl(config.owner, config.repo, config.branch, p)).join('\n');
      copyToClipboard(urls);
      showToast(`Copied ${paths.length} URL${paths.length > 1 ? 's' : ''}`);
      break;
    }
    case 'copy-all': {
      const all = paths.flatMap((p) =>
        CDN_PROVIDERS.map((prov) => prov.url(config.owner, config.repo, config.branch, p))
      ).join('\n');
      copyToClipboard(all);
      showToast('All CDN URLs copied');
      break;
    }
    case 'copy-html': {
      const html = paths.map((p) => {
        const url = getCdnUrl(config.owner, config.repo, config.branch, p);
        const name = p.split('/').pop();
        return /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(name)
          ? `<img src="${url}" alt="${name}" />`
          : `<a href="${url}">${name}</a>`;
      }).join('\n');
      copyToClipboard(html);
      showToast('HTML copied');
      break;
    }
    case 'copy-md': {
      const md = paths.map((p) => {
        const url = getCdnUrl(config.owner, config.repo, config.branch, p);
        const name = p.split('/').pop();
        return /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(name)
          ? `![${name}](${url})`
          : `[${name}](${url})`;
      }).join('\n');
      copyToClipboard(md);
      showToast('Markdown copied');
      break;
    }
    case 'url-panel':
      showUrlPanel(file, config);
      break;
    case 'open-tab': {
      const url = getRawUrl(config.owner, config.repo, config.branch, file.path);
      window.open(url, '_blank');
      break;
    }
    case 'download': {
      const url = getRawUrl(config.owner, config.repo, config.branch, file.path);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      break;
    }
    case 'rename': {
      const nameEl = document.querySelector(`.file-card[data-path="${file.path}"] .file-name`);
      if (nameEl) startRename(nameEl, file, config);
      break;
    }
    case 'batch-rename':
      showBatchRename(config);
      break;
    case 'toggle-fav': {
      const added = toggleFavorite(file.path);
      showToast(added ? `Pinned ${file.name}` : `Unpinned ${file.name}`);
      loadFiles(config);
      break;
    }
    case 'delete':
      if (sel.size > 1) {
        $('#bulk-delete').click();
      } else {
        showDeleteModal(file, config);
      }
      break;
  }
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

// ── Batch Rename ──

function showBatchRename(config) {
  const sel = getSelected();
  if (sel.size === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h3>Batch rename (${sel.size} files)</h3>
      <div style="display:flex;flex-direction:column;gap:8px;margin:12px 0;">
        <label style="font-size:13px;color:var(--text-muted);">Add prefix</label>
        <input type="text" id="br-prefix" class="staging-input" placeholder="e.g. banner-" />
        <label style="font-size:13px;color:var(--text-muted);">Add suffix (before extension)</label>
        <input type="text" id="br-suffix" class="staging-input" placeholder="e.g. -v2" />
        <label style="font-size:13px;color:var(--text-muted);">Find & replace</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="br-find" class="staging-input" placeholder="Find" />
          <input type="text" id="br-replace" class="staging-input" placeholder="Replace" />
        </div>
        <div id="br-preview" style="font-size:12px;color:var(--text-muted);max-height:120px;overflow-y:auto;margin-top:4px;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-sm" id="br-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="br-apply">Rename</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const paths = [...sel];
  const files = paths.map((p) => currentFiles.find((f) => f.path === p)).filter(Boolean);

  const updatePreview = () => {
    const prefix = overlay.querySelector('#br-prefix').value;
    const suffix = overlay.querySelector('#br-suffix').value;
    const find = overlay.querySelector('#br-find').value;
    const replace = overlay.querySelector('#br-replace').value;
    const preview = overlay.querySelector('#br-preview');

    preview.innerHTML = files.slice(0, 10).map((f) => {
      const newName = applyRename(f.name, prefix, suffix, find, replace);
      const changed = newName !== f.name;
      return `<div>${f.name} ${changed ? `&rarr; <strong>${escapeHtml(newName)}</strong>` : '<span style="color:var(--text-muted);">(no change)</span>'}</div>`;
    }).join('') + (files.length > 10 ? `<div>...and ${files.length - 10} more</div>` : '');
  };

  ['#br-prefix', '#br-suffix', '#br-find', '#br-replace'].forEach((s) => {
    overlay.querySelector(s).addEventListener('input', updatePreview);
  });
  updatePreview();

  overlay.querySelector('#br-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#br-apply').addEventListener('click', async () => {
    const prefix = overlay.querySelector('#br-prefix').value;
    const suffix = overlay.querySelector('#br-suffix').value;
    const find = overlay.querySelector('#br-find').value;
    const replace = overlay.querySelector('#br-replace').value;
    overlay.remove();

    let renamed = 0;
    for (const file of files) {
      const newName = applyRename(file.name, prefix, suffix, find, replace);
      if (newName === file.name) continue;
      const dir = file.path.substring(0, file.path.lastIndexOf('/'));
      const newPath = dir ? `${dir}/${newName}` : newName;
      try {
        await renameFile(config.owner, config.repo, file.path, newPath);
        renamed++;
      } catch (err) {
        showToast(`Failed to rename ${file.name}: ${err.message}`, 'error');
      }
    }
    if (renamed > 0) {
      showToast(`Renamed ${renamed} file${renamed > 1 ? 's' : ''}`);
      clearSelection();
      await loadFiles(config);
    }
  });
}

function applyRename(name, prefix, suffix, find, replace) {
  let result = name;
  if (find) result = result.split(find).join(replace);
  const dotIdx = result.lastIndexOf('.');
  if (dotIdx > 0) {
    result = prefix + result.substring(0, dotIdx) + suffix + result.substring(dotIdx);
  } else {
    result = prefix + result + suffix;
  }
  return result;
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

    // Escape — close modals or clear selection
    if (e.key === 'Escape') {
      const modal = $('.modal-overlay');
      if (modal) { modal.remove(); return; }
      if (getSelected().size > 0) {
        clearSelection();
        return;
      }
    }

    // Ctrl+A — select all
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
      return;
    }

    // Delete — delete selected files
    if ((e.key === 'Delete' || e.key === 'Backspace') && getSelected().size > 0) {
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

  const favs = getFavorites();
  const sortVal = $('#sort-select')?.value || 'name-asc';
  filtered.sort((a, b) => {
    const aFav = favs.includes(a.path) ? 1 : 0;
    const bFav = favs.includes(b.path) ? 1 : 0;
    if (aFav !== bFav) return bFav - aFav;
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
  filtered.forEach((file, idx) => {
    grid.appendChild(createFileCard(file, config, idx));
  });
}

// ── Selection Bar ──

let currentFiles = [];

function onSelectionChange(sel, config) {
  const bar = $('#bulk-bar');
  const count = sel.size;
  if (bar) bar.style.display = count > 0 ? 'flex' : 'none';
  const countEl = $('#bulk-count');
  if (countEl) countEl.textContent = `${count} selected`;

  // Update visual selection on cards
  document.querySelectorAll('.file-card[data-path]').forEach((card) => {
    card.classList.toggle('selected', sel.has(card.dataset.path));
  });
}

function setupSelectionBar(config) {
  $('#bulk-clear').addEventListener('click', () => clearSelection());

  $('#bulk-select-all').addEventListener('click', () => {
    const sel = getSelected();
    const allFiles = currentFiles.filter((f) => f.type !== 'dir');
    if (sel.size === allFiles.length) clearSelection();
    else selectAll();
  });

  $('#bulk-copy').addEventListener('click', () => {
    const sel = getSelected();
    if (sel.size === 0) return;
    const urls = [...sel].map((path) =>
      getCdnUrl(config.owner, config.repo, config.branch, path)
    ).join('\n');
    copyToClipboard(urls);
    showToast(`Copied ${sel.size} URL${sel.size > 1 ? 's' : ''}`);
  });

  $('#bulk-delete').addEventListener('click', () => {
    const sel = getSelected();
    if (sel.size === 0) return;
    const count = sel.size;
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
      const paths = [...sel];
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
      clearSelection();
      await loadFiles(config);
    });
  });
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

  dz.addEventListener('drop', async (e) => {
    e.preventDefault();
    dz.classList.remove('active');
    const items = e.dataTransfer.items;
    if (items && items[0]?.webkitGetAsEntry) {
      const files = await getFilesFromDrop(items);
      stageFiles(files);
    } else {
      stageFiles(e.dataTransfer.files);
    }
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

    // Warn if file already exists in repo
    const existsInRepo = currentFiles.some((f) => f.name === file.name);
    if (existsInRepo) {
      showToast(`${file.name} already exists — will overwrite`, 'error');
    }

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

  // Check file size limits
  const oversized = stagedFiles.filter((s) => s.file.size > MAX_FILE_SIZE);
  if (oversized.length > 0) {
    showToast(`${oversized.map((s) => s.file.name).join(', ')} exceeds 100 MB limit`, 'error');
    return;
  }

  // Check storage limit
  try {
    const info = await getRepoInfo(config.owner, config.repo);
    const currentBytes = info.size * 1024;
    const uploadBytes = stagedFiles.reduce((sum, s) => sum + s.file.size, 0);
    if (currentBytes + uploadBytes > STORAGE_LIMIT) {
      showToast(`Upload would exceed 1 GB storage limit (${formatSize(currentBytes)} used + ${formatSize(uploadBytes)} new)`, 'error');
      return;
    }
  } catch { /* continue anyway */ }

  const files = [...stagedFiles];
  const defaultMsg = files.length === 1
    ? `Upload ${files[0].file.name}`
    : `Upload ${files.length} files`;
  const commitMsg = message || defaultMsg;

  const bar = $('#upload-bar');
  const fill = $('#upload-fill');
  const status = $('#upload-status');
  bar.classList.add('visible');

  try {
    // Prepare all blobs
    const batchFiles = [];
    for (let i = 0; i < files.length; i++) {
      status.textContent = `Preparing ${files[i].file.name} (${i + 1}/${files.length})...`;
      fill.style.width = `${(i / files.length) * 50}%`;
      const base64 = await fileToBase64(files[i].file);
      const path = currentPath ? `${currentPath}/${files[i].file.name}` : files[i].file.name;
      batchFiles.push({ path, base64 });
    }

    // Single batch commit
    status.textContent = `Committing ${files.length} file${files.length > 1 ? 's' : ''}...`;
    fill.style.width = '75%';
    await batchUpload(config.owner, config.repo, config.branch, batchFiles, commitMsg);

    files.forEach((s) => URL.revokeObjectURL(s.preview));
    // Track recent uploads
    batchFiles.forEach((bf) => addRecent(bf.path, config.owner, config.repo, config.branch));
    fill.style.width = '100%';
    status.textContent = `Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`;
  } catch (err) {
    showToast(`Upload failed: ${err.message}`, 'error');
  }

  setTimeout(() => {
    bar.classList.remove('visible');
    fill.style.width = '0%';
  }, 2000);

  stagedFiles = [];
  renderStagingArea();
  await loadFiles(config);
  loadRepoSize(config);
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

async function getFilesFromDrop(dataTransferItems) {
  const files = [];

  async function readEntry(entry, path = '') {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve));
      // Preserve relative path from folder
      const relativePath = path ? `${path}/${file.name}` : file.name;
      const namedFile = new File([file], relativePath, { type: file.type });
      files.push(namedFile);
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise((resolve) => reader.readEntries(resolve));
      for (const child of entries) {
        await readEntry(child, path ? `${path}/${entry.name}` : entry.name);
      }
    }
  }

  const entries = [];
  for (const item of dataTransferItems) {
    const entry = item.webkitGetAsEntry();
    if (entry) entries.push(entry);
  }
  for (const entry of entries) {
    await readEntry(entry);
  }
  return files;
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

// ── Walkthrough ──

const WALKTHROUGH_KEY = 'gitassets_walkthrough_done';

function showWalkthrough() {
  if (localStorage.getItem(WALKTHROUGH_KEY)) return;

  const steps = [
    { el: '#dropzone', text: 'Drop files here or click Upload to stage them', pos: 'bottom' },
    { el: '#search-input', text: 'Search and filter your files', pos: 'bottom' },
    { el: '#change-repo-btn', text: 'Switch between repositories', pos: 'bottom' },
    { el: '#storage-bar', text: 'Track your storage usage (1 GB limit)', pos: 'bottom' },
    { el: '#history-btn', text: 'View upload history and deleted files', pos: 'bottom' },
  ];

  let current = 0;

  function showStep() {
    document.querySelectorAll('.walkthrough-tooltip').forEach((t) => t.remove());
    document.querySelectorAll('.walkthrough-highlight').forEach((t) => t.classList.remove('walkthrough-highlight'));

    if (current >= steps.length) {
      localStorage.setItem(WALKTHROUGH_KEY, 'true');
      return;
    }

    const step = steps[current];
    const target = document.querySelector(step.el);
    if (!target) { current++; showStep(); return; }

    target.classList.add('walkthrough-highlight');
    const rect = target.getBoundingClientRect();

    const tooltip = document.createElement('div');
    tooltip.className = 'walkthrough-tooltip';
    tooltip.innerHTML = `
      <div class="walkthrough-text">${step.text}</div>
      <div class="walkthrough-actions">
        <span class="walkthrough-counter">${current + 1}/${steps.length}</span>
        <button class="btn btn-sm" id="wt-skip">Skip</button>
        <button class="btn btn-primary btn-sm" id="wt-next">${current === steps.length - 1 ? 'Done' : 'Next'}</button>
      </div>
    `;

    tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
    document.body.appendChild(tooltip);

    // Keep on screen
    const ttRect = tooltip.getBoundingClientRect();
    if (ttRect.right > window.innerWidth) {
      tooltip.style.left = `${window.innerWidth - ttRect.width - 16}px`;
    }

    tooltip.querySelector('#wt-next').addEventListener('click', () => {
      current++;
      showStep();
    });
    tooltip.querySelector('#wt-skip').addEventListener('click', () => {
      document.querySelectorAll('.walkthrough-tooltip').forEach((t) => t.remove());
      document.querySelectorAll('.walkthrough-highlight').forEach((t) => t.classList.remove('walkthrough-highlight'));
      localStorage.setItem(WALKTHROUGH_KEY, 'true');
    });
  }

  // Delay slightly so DOM is ready
  setTimeout(showStep, 500);
}

// ── Stats Dashboard ──

function setupStatsButton(config) {
  $('#stats-btn').addEventListener('click', () => showStats(config));
}

async function showStats(config) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="history-header">
        <h3>Repository Stats</h3>
        <button class="btn-icon history-close">&times;</button>
      </div>
      <div style="text-align:center;padding:20px;"><span class="spinner"></span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('.history-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  try {
    const info = await getRepoInfo(config.owner, config.repo);
    const sizeBytes = info.size * 1024;
    const pct = Math.min((sizeBytes / STORAGE_LIMIT) * 100, 100);

    // Count files by type in current view
    const typeMap = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const f of currentFiles) {
      if (f.type === 'dir') continue;
      totalFiles++;
      totalSize += f.size || 0;
      const ext = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : 'other';
      typeMap[ext] = (typeMap[ext] || 0) + 1;
    }

    const sortedTypes = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
    const folders = currentFiles.filter((f) => f.type === 'dir').length;

    const modal = overlay.querySelector('.modal');
    modal.innerHTML = `
      <div class="history-header">
        <h3>Repository Stats</h3>
        <button class="btn-icon history-close">&times;</button>
      </div>
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-value">${formatSize(sizeBytes)}</div>
          <div class="stats-label">Repository size</div>
          <div class="stats-bar"><div class="stats-bar-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warn' : 'ok'}" style="width:${pct}%"></div></div>
          <div class="stats-sublabel">${pct.toFixed(1)}% of 1 GB used</div>
        </div>
        <div class="stats-row">
          <div class="stats-card small">
            <div class="stats-value">${totalFiles}</div>
            <div class="stats-label">Files (current folder)</div>
          </div>
          <div class="stats-card small">
            <div class="stats-value">${folders}</div>
            <div class="stats-label">Folders</div>
          </div>
          <div class="stats-card small">
            <div class="stats-value">${formatSize(totalSize)}</div>
            <div class="stats-label">Current folder size</div>
          </div>
        </div>
        ${sortedTypes.length > 0 ? `
        <div class="stats-card">
          <div class="stats-label" style="margin-bottom:8px;">File types</div>
          <div class="stats-types">${sortedTypes.map(([ext, count]) =>
            `<span class="stats-type">.${ext} <strong>${count}</strong></span>`
          ).join('')}</div>
        </div>
        ` : ''}
      </div>
    `;

    modal.querySelector('.history-close').addEventListener('click', () => overlay.remove());
  } catch (err) {
    overlay.querySelector('.modal').innerHTML = `<p style="color:var(--danger);padding:24px;">Error: ${err.message}</p>`;
  }
}

// ── Recent Uploads ──

function renderRecentUploads(config) {
  let section = $('#recent-uploads');
  const recent = getRecent().filter((r) => r.owner === config.owner && r.repo === config.repo);

  if (recent.length === 0) {
    if (section) section.remove();
    return;
  }

  if (!section) {
    section = document.createElement('div');
    section.id = 'recent-uploads';
    section.className = 'recent-uploads';
    const dashboard = $('.dashboard');
    const fileArea = $('#file-area');
    dashboard.insertBefore(section, fileArea);
  }

  section.innerHTML = `
    <div class="recent-header">
      <span class="recent-title">Recent uploads</span>
      <button class="btn-icon" id="recent-dismiss" title="Dismiss">&times;</button>
    </div>
    <div class="recent-list">${recent.map((r) => {
      const name = r.path.split('/').pop();
      const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(name);
      const url = getCdnUrl(r.owner, r.repo, r.branch, r.path);
      const thumb = isImage ? getRawUrl(r.owner, r.repo, r.branch, r.path) : '';
      const ago = timeAgo(r.time);
      return `<div class="recent-item" data-url="${url}" title="${r.path}">
        ${thumb ? `<img class="recent-thumb" src="${thumb}" />` : `<span class="recent-icon">&#128196;</span>`}
        <span class="recent-name">${name}</span>
        <span class="recent-time">${ago}</span>
      </div>`;
    }).join('')}</div>
  `;

  section.querySelector('#recent-dismiss').addEventListener('click', () => section.remove());

  section.querySelectorAll('.recent-item').forEach((item) => {
    item.addEventListener('click', () => {
      copyToClipboard(item.dataset.url);
      showToast('URL copied');
    });
  });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Storage Bar ──

const STORAGE_LIMIT = 1024 * 1024 * 1024; // 1 GB

async function loadRepoSize(config) {
  try {
    const info = await getRepoInfo(config.owner, config.repo);
    const sizeBytes = info.size * 1024; // API returns KB
    const pct = Math.min((sizeBytes / STORAGE_LIMIT) * 100, 100);

    const fill = $('#storage-fill');
    const label = $('#storage-label');
    const bar = $('#storage-bar');
    if (!fill || !label || !bar) return;

    fill.style.width = `${pct}%`;
    label.textContent = `${formatSize(sizeBytes)} / 1 GB`;

    bar.classList.remove('storage-ok', 'storage-warn', 'storage-danger');
    if (pct > 90) bar.classList.add('storage-danger');
    else if (pct > 70) bar.classList.add('storage-warn');
    else bar.classList.add('storage-ok');
  } catch { /* ignore */ }
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
