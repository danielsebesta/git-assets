import { login, logout, getToken } from './auth.js?v=11';
import { getUser, listRepos, listFiles, uploadFile, deleteFile, renameFile, batchUpload, getRepoInfo, MAX_FILE_SIZE, getCdnUrl, getRawUrl, CDN_PROVIDERS, getCommits, getCommitDetail, getRawUrlAtCommit, getRateLimit } from './github.js?v=11';
import { getConfig, saveConfig, clearConfig, getRepoList, ASSETS_ROOT, getSavedRepos, toggleFavorite, isFavorite, getFavorites, addRecent, getRecent } from './config.js?v=11';
import { compressImage } from './compress.js?v=11';
import { initSelection, setFiles, getSelected, clearSelection, selectAll, isSelected, handleClick as selectionClick } from './selection.js?v=11';

// ── Logo ──
const LOGO_SVG = `<svg viewBox="0 0 131.914 132.292" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M34.381 178.86c-2.113-.309-3.476-.715-4.92-1.466-3.455-1.797-5.949-4.92-7.035-8.807l-.308-1.105-.03-33.825c-.028-30-.011-33.942.148-34.86.842-4.883 4.434-9.04 9.18-10.627 2.004-.67 1.487-.644 13.717-.69 7.906-.03 11.62-.004 12.426.088a13.6 13.6 0 0 1 7.955 3.762c1.13 1.101 1.904 2.109 2.558 3.327.69 1.286.917 1.926 1.52 4.29l.547 2.14 2.615-2.953c1.438-1.625 3.849-4.352 5.357-6.062l2.743-3.109-.22-.702c-.946-3.043-.173-6.715 1.934-9.18 1.365-1.598 3.022-2.629 5.182-3.224.573-.157 1.125-.199 2.427-.182.927.012 1.83.038 2.005.057.291.033.946-.673 7.297-7.864 4.908-5.557 6.955-7.953 6.902-8.079-.238-.563-.527-1.938-.589-2.804-.173-2.425.684-5.038 2.274-6.931 1.214-1.445 2.589-2.383 4.463-3.043 1.181-.417 1.195-.418 3.105-.414 1.78.004 1.989.028 2.906.33 3.566 1.172 6.115 4.028 6.79 7.611 1.069 5.661-2.896 10.988-8.664 11.642-1.203.136-2.722 0-3.817-.34l-.713-.222-6.488 7.342c-3.569 4.038-6.448 7.358-6.397 7.377.05.02 2.2-.098 4.779-.261 2.578-.164 8.924-.56 14.103-.88 15.323-.947 16.958-1.051 16.976-1.078.009-.014.22-.417.47-.897.613-1.176 2.412-2.99 3.651-3.684 2.723-1.522 5.942-1.72 8.777-.536 1.043.435 2.493 1.445 3.275 2.28 1.807 1.932 2.705 4.18 2.71 6.786.007 4.47-2.808 8.22-7.148 9.519-.9.27-1.265.315-2.615.323-1.82.011-2.645-.16-4.167-.865-1.817-.843-3.454-2.288-4.319-3.812a24 24 0 0 0-.528-.899c-.11-.162-1.851-.074-17.204.874-19.353 1.196-18.535 1.136-18.535 1.346 0 .363-1.212 2.509-1.844 3.267-1.238 1.483-3.13 2.675-5.079 3.2-1.663.448-4.332.312-5.873-.3-.137-.054-1.443 1.354-5.034 5.425l-4.85 5.497 16.775.062c15.166.055 16.87.08 17.776.26 2.783.549 5.25 1.854 7.193 3.803 2.2 2.21 3.579 5.011 3.946 8.023.1.813.125 7.47.097 25.282l-.039 24.178-.275 1.046c-.662 2.514-1.741 4.505-3.394 6.26-1.982 2.104-4.195 3.358-7.253 4.112-.76.187-3.282.201-38.881.217-20.938.009-38.2-.002-38.36-.025m76.376-9.53c.917-.434 1.484-.913 1.951-1.647.772-1.214.722.635.689-25.606l-.03-23.77-.38-.771c-.481-.977-1.493-1.943-2.435-2.323l-.672-.272H72.392c-35.777 0-37.515.01-38.086.21a4.74 4.74 0 0 0-2.852 2.725l-.27.669-.033 23.306c-.023 16.43.004 23.526.094 24.05.306 1.794 1.705 3.33 3.401 3.736.206.049 17.244.081 37.862.072l37.488-.018zM32.52 106.154c1.574-.403 3.278-.45 16.42-.452 8.76-.002 12.873-.04 12.873-.122 0-.36-1.45-5.843-1.679-6.345-.513-1.129-1.601-2.053-2.847-2.417-.556-.163-1.904-.185-11.4-.185-9.556 0-10.838.022-11.399.187-1.7.504-2.915 1.852-3.236 3.588-.07.377-.127 1.911-.127 3.41v2.723l.262-.082c.144-.044.654-.182 1.133-.305" transform="translate(-22.077 -46.596)"/></svg>`;

// ── SVG Icons ──
const icon = (path, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

const ICONS = {
  github: `<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>`,
  sun: icon('<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'),
  moon: icon('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'),
  zap: icon('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>', 20),
  package: icon('<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>', 20),
  image: icon('<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>', 20),
  shield: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', 20),
  clock: icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  chart: icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  folder: icon('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>', 28),
  file: icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', 20),
  pin: icon('<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', 12),
  link: icon('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', 14),
  trash: icon('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 14),
  x: icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>', 18),
};

// ── Focus Trap ──
function trapFocus(overlay) {
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const close = () => overlay.remove();
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    const focusable = overlay.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  // Focus first focusable element
  requestAnimationFrame(() => {
    const first = overlay.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  });
}

const GITHUB_ICON = ICONS.github;

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
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#000000' : '#ffffff';
}

// Apply saved theme on load
setTheme(getTheme());

export function showToast(msg, type = 'success') {
  const existing = $('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Login Screen (Landing Page) ──

export function renderLogin() {
  // Show static landing, hide app
  $('#landing').style.display = '';
  $('#app').style.display = 'none';
  $('#header').style.display = 'none';

  // Update theme icon to match current theme
  const themeBtn = $('#landing-theme-btn');
  themeBtn.innerHTML = getTheme() === 'dark' ? ICONS.sun : ICONS.moon;

  // Attach event listeners
  const loginAction = () => login();
  $('#login-btn').addEventListener('click', loginAction);
  $('#login-btn-top').addEventListener('click', loginAction);
  themeBtn.addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    themeBtn.innerHTML = next === 'dark' ? ICONS.sun : ICONS.moon;
  });
}

// ── Setup Wizard ──

export async function renderSetup() {
  $('#landing').style.display = 'none';
  const app = $('#app');
  app.style.display = '';
  app.innerHTML = `
    <div class="setup-screen">
      <h2>Pick a repository</h2>
      <p>Choose any repo to store your assets — or enter one manually.</p>
      <div class="setup-detecting"><span class="spinner"></span> Loading your repos...</div>
    </div>
  `;

  try {
    currentUser = currentUser || await getUser();

    allRepos = allRepos || await listRepos();
    const pushable = getRepoList(allRepos);

    const container = app.querySelector('.setup-screen');
    container.innerHTML = `
      <h2>Pick a repository</h2>
      <p>Choose any repo to store your assets, or enter one manually.</p>
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

    $('#manual-btn').addEventListener('click', async () => {
      const val = $('#manual-repo').value.trim();
      const parts = val.split('/');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        showToast('Enter as owner/repo', 'error');
        return;
      }
      const btn = $('#manual-btn');
      btn.disabled = true;
      btn.textContent = 'Checking...';
      try {
        const info = await getRepoInfo(parts[0], parts[1]);
        saveConfig({ owner: parts[0], repo: parts[1], branch: info.default_branch || 'main' });
        renderDashboard();
      } catch {
        showToast('Repository not found or not accessible', 'error');
        btn.disabled = false;
        btn.textContent = 'Use';
      }
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

  $('#landing').style.display = 'none';
  $('#app').style.display = '';
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
          <button class="btn btn-sm" id="new-folder-btn">New folder</button>
          <button class="btn btn-sm btn-icon" id="history-btn" title="History" aria-label="History">${ICONS.clock}</button>
          <button class="btn btn-sm btn-icon" id="stats-btn" title="Stats" aria-label="Stats">${ICONS.chart}</button>
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
        <div class="dropzone-text">Drop files here, paste from clipboard, or click Upload</div>
        <div class="dropzone-hint">Images auto-compress to WebP</div>
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
  const config = getConfig();
  const repoLabel = config ? config.repo : 'root';
  const parts = currentPath.split('/').filter(Boolean);

  let html = `<a data-path="">${repoLabel}</a>`;
  let accumulated = '';
  for (const part of parts) {
    accumulated = accumulated ? accumulated + '/' + part : part;
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
          <p>Drop files here or click Upload to get started.</p>
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
    thumbHtml = `<div class="file-thumb-placeholder"><span class="folder-icon">${ICONS.folder}</span></div>`;
  } else if (isImage) {
    const thumbUrl = getRawUrl(config.owner, config.repo, config.branch, file.path);
    thumbHtml = `<img class="file-thumb" src="${thumbUrl}" alt="${file.name}" loading="lazy" /><div class="hover-preview"><img src="${thumbUrl}" alt="${file.name}" /></div>`;
  } else {
    thumbHtml = `<div class="file-thumb-placeholder">${ICONS.file}</div>`;
  }

  const sizeText = file.size ? formatSize(file.size) : '';

  card.innerHTML = `
    ${thumbHtml}
    <div class="file-info">
      <div class="file-name" title="${file.name}">${isFavorite(file.path) ? '<span class="pin-icon">${ICONS.pin}</span> ' : ''}${file.name}</div>
      ${sizeText ? `<div class="file-size">${sizeText}</div>` : ''}
    </div>
    ${!isDir ? `
    <div class="file-actions">
      <button class="btn-icon" title="Copy URL" data-action="copy-menu">${ICONS.link}</button>
      <button class="btn-icon" title="Delete" data-action="delete" style="color:var(--danger);">${ICONS.trash}</button>
    </div>
    ` : ''}
  `;

  if (isDir) {
    card.style.cursor = 'pointer';
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Open folder ${file.name}`);
    const openFolder = () => {
      currentPath = file.path;
      clearSelection();
      renderBreadcrumbs();
      loadFiles(config);
    };
    card.addEventListener('click', openFolder);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFolder(); }
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
  if (rect.right > window.innerWidth) menu.style.left = `${Math.max(0, x - rect.width)}px`;
  if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(0, y - rect.height)}px`;

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
  const safeName = escapeHtml(file.name);
  const htmlSnippet = isImage ? `<img src="${primaryUrl}" alt="${safeName}" />` : `<a href="${primaryUrl}">${safeName}</a>`;
  const mdSnippet = isImage ? `![${safeName}](${primaryUrl})` : `[${safeName}](${primaryUrl})`;

  const altUrls = urls.slice(1);

  overlay.innerHTML = `
    <div class="modal url-panel">
      <div class="history-header">
        <h3>${file.name}</h3>
        <button class="btn-icon history-close">${ICONS.x}</button>
      </div>
      ${isImage ? `<img class="url-panel-preview" src="${urls[1].url}" alt="${file.name}" />` : ''}
      <div class="url-panel-list">
        <div class="url-panel-item">
          <span class="url-panel-label">${urls[0].name} (recommended)</span>
          <div class="url-panel-row">
            <code class="url-panel-url">${urls[0].url}</code>
            <button class="btn btn-primary btn-sm url-panel-copy" data-url="${urls[0].url}">Copy</button>
          </div>
        </div>
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
        <details class="url-panel-alt">
          <summary>Alternative CDN providers</summary>
          ${altUrls.map((u) => `
            <div class="url-panel-item">
              <span class="url-panel-label">${u.name}</span>
              <div class="url-panel-row">
                <code class="url-panel-url">${u.url}</code>
                <button class="btn btn-sm url-panel-copy" data-url="${u.url}">Copy</button>
              </div>
            </div>
          `).join('')}
        </details>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  trapFocus(overlay);

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
  trapFocus(overlay);

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
        <label for="br-prefix" style="font-size:13px;color:var(--text-muted);">Add prefix</label>
        <input type="text" id="br-prefix" class="staging-input" placeholder="e.g. banner-" />
        <label for="br-suffix" style="font-size:13px;color:var(--text-muted);">Add suffix (before extension)</label>
        <input type="text" id="br-suffix" class="staging-input" placeholder="e.g. -v2" />
        <label id="br-fr-label" style="font-size:13px;color:var(--text-muted);">Find & replace</label>
        <div style="display:flex;gap:8px;">
          <input type="text" id="br-find" class="staging-input" placeholder="Find" aria-labelledby="br-fr-label" />
          <input type="text" id="br-replace" class="staging-input" placeholder="Replace" aria-labelledby="br-fr-label" />
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
  trapFocus(overlay);

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
        <label for="folder-name-input" class="sr-only">Folder name</label>
        <input type="text" id="folder-name-input" class="staging-input" placeholder="Folder name" style="width:100%;margin:12px 0;" />
        <div class="modal-actions">
          <button class="btn btn-sm" id="folder-cancel">Cancel</button>
          <button class="btn btn-primary btn-sm" id="folder-create">Create</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    trapFocus(overlay);

    const input = overlay.querySelector('#folder-name-input');

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
    trapFocus(overlay);
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

    let result;
    try {
      result = await compressImage(file);
    } catch (err) {
      showToast(`Failed to process ${file.name}: ${err.message}`, 'error');
      continue;
    }
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
      ${isImage ? `<img class="staging-thumb" src="${staged.preview}" />` : `<div class="staging-thumb-placeholder">${ICONS.file}</div>`}
      <div class="staging-info">
        <span class="staging-name" title="${staged.file.name}">${staged.file.name}</span>
        <span class="staging-file-size">${formatSize(staged.file.size)} ${savingsHtml}</span>
      </div>
      <button class="btn-icon staging-remove" data-index="${i}" title="Remove">${ICONS.x}</button>
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
    stagedFiles = [];
  } catch (err) {
    showToast(`Upload failed: ${err.message}. Files kept in staging for retry.`, 'error');
    // Don't clear staging — let user retry
  }

  setTimeout(() => {
    bar.classList.remove('visible');
    fill.style.width = '0%';
  }, 2000);

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
    try {
      if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const relativePath = path ? `${path}/${file.name}` : file.name;
        const namedFile = new File([file], relativePath, { type: file.type });
        files.push(namedFile);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of entries) {
          await readEntry(child, path ? `${path}/${entry.name}` : entry.name);
        }
      }
    } catch {
      // Skip files that can't be read (e.g. permission denied)
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

      // Clean up staged file previews
      stagedFiles.forEach((s) => URL.revokeObjectURL(s.preview));
      stagedFiles = [];

      if (item.dataset.action === 'add-new') {
        clearConfig();
        currentPath = '';
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
      currentPath = '';
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
        <button class="btn-icon history-close">${ICONS.x}</button>
      </div>
      <div class="history-content">
        <div style="text-align:center;padding:40px;"><span class="spinner"></span></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  trapFocus(overlay);

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
        <button class="btn-icon history-close">${ICONS.x}</button>
      </div>
      <div style="text-align:center;padding:20px;"><span class="spinner"></span></div>
    </div>
  `;
  document.body.appendChild(overlay);
  trapFocus(overlay);
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
        <button class="btn-icon history-close">${ICONS.x}</button>
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
      <button class="btn-icon" id="recent-dismiss" title="Dismiss">${ICONS.x}</button>
    </div>
    <div class="recent-list">${recent.map((r) => {
      const name = r.path.split('/').pop();
      const isImage = /\.(jpe?g|png|gif|webp|svg|ico|bmp|avif)$/i.test(name);
      const url = getCdnUrl(r.owner, r.repo, r.branch, r.path);
      const thumb = isImage ? getRawUrl(r.owner, r.repo, r.branch, r.path) : '';
      const ago = timeAgo(r.time);
      return `<div class="recent-item" data-url="${url}" title="${r.path}">
        ${thumb ? `<img class="recent-thumb" src="${thumb}" />` : `<span class="recent-icon">${ICONS.file}</span>`}
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

let repoSizeGeneration = 0;

async function loadRepoSize(config) {
  const gen = ++repoSizeGeneration;
  try {
    const info = await getRepoInfo(config.owner, config.repo);
    if (gen !== repoSizeGeneration) return; // stale response
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
    // Landing page renders its own nav, hide the app header
    header.style.display = 'none';
    return;
  }
  header.style.display = '';
  header.innerHTML = `
    <a class="header-logo" href="#">${LOGO_SVG} GitAssets</a>
    <div class="header-right">
      <span class="header-user">
        <img class="header-avatar" src="${user.avatar_url}" alt="${user.login}" />
        ${user.login}
      </span>
      <button class="btn btn-sm btn-icon" id="theme-btn" title="Toggle theme">${getTheme() === 'dark' ? ICONS.sun : ICONS.moon}</button>
      <button class="btn btn-sm" id="logout-btn">Logout</button>
    </div>
  `;
  $('#theme-btn').addEventListener('click', () => {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    $('#theme-btn').innerHTML = next === 'dark' ? ICONS.sun : ICONS.moon;
  });
  $('#logout-btn').addEventListener('click', () => {
    clearConfig();
    logout();
  });
}
