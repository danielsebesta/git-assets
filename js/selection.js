// OS-style file selection: click, shift+click, ctrl+click, rubber band drag

let selected = new Set();
let lastClickedIndex = -1;
let orderedFiles = [];
let onChangeCallback = null;
let rubberBand = null;
let rbStart = null;

export function initSelection(onChange) {
  onChangeCallback = onChange;
  selected.clear();
  lastClickedIndex = -1;
  setupRubberBand();
}

export function setFiles(files) {
  orderedFiles = files;
  // Remove selections for files no longer present
  const paths = new Set(files.map((f) => f.path));
  for (const p of selected) {
    if (!paths.has(p)) selected.delete(p);
  }
}

export function getSelected() {
  return selected;
}

export function clearSelection() {
  selected.clear();
  lastClickedIndex = -1;
  notify();
}

export function selectAll() {
  orderedFiles.forEach((f) => {
    if (f.type !== 'dir') selected.add(f.path);
  });
  notify();
}

export function isSelected(path) {
  return selected.has(path);
}

export function handleClick(path, index, e) {
  const file = orderedFiles[index];
  if (!file || file.type === 'dir') return;

  if (e.shiftKey && lastClickedIndex >= 0) {
    // Range select
    const start = Math.min(lastClickedIndex, index);
    const end = Math.max(lastClickedIndex, index);
    if (!e.ctrlKey && !e.metaKey) selected.clear();
    for (let i = start; i <= end; i++) {
      if (orderedFiles[i].type !== 'dir') {
        selected.add(orderedFiles[i].path);
      }
    }
  } else if (e.ctrlKey || e.metaKey) {
    // Toggle single
    if (selected.has(path)) selected.delete(path);
    else selected.add(path);
  } else {
    // Single select
    selected.clear();
    selected.add(path);
  }

  lastClickedIndex = index;
  notify();
}

function notify() {
  if (onChangeCallback) onChangeCallback(selected);
}

// ── Rubber Band Selection ──

function setupRubberBand() {
  // Remove old listeners if any
  document.removeEventListener('mousedown', onRbMouseDown);
  document.removeEventListener('mousemove', onRbMouseMove);
  document.removeEventListener('mouseup', onRbMouseUp);

  document.addEventListener('mousedown', onRbMouseDown);
  document.addEventListener('mousemove', onRbMouseMove);
  document.addEventListener('mouseup', onRbMouseUp);
}

function onRbMouseDown(e) {
  // Only start on file-grid background, not on cards or buttons
  const grid = document.getElementById('file-grid');
  if (!grid || e.target !== grid) return;
  if (e.button !== 0) return;

  e.preventDefault();
  rbStart = { x: e.pageX, y: e.pageY };

  if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
    selected.clear();
    notify();
  }

  rubberBand = document.createElement('div');
  rubberBand.className = 'rubber-band';
  document.body.appendChild(rubberBand);
}

function onRbMouseMove(e) {
  if (!rubberBand || !rbStart) return;

  const x = Math.min(rbStart.x, e.pageX);
  const y = Math.min(rbStart.y, e.pageY);
  const w = Math.abs(e.pageX - rbStart.x);
  const h = Math.abs(e.pageY - rbStart.y);

  rubberBand.style.left = `${x}px`;
  rubberBand.style.top = `${y}px`;
  rubberBand.style.width = `${w}px`;
  rubberBand.style.height = `${h}px`;

  // Check intersection with file cards
  const bandRect = { left: x, top: y, right: x + w, bottom: y + h };
  const cards = document.querySelectorAll('.file-card[data-path]');

  const newSelected = new Set(e.ctrlKey || e.metaKey ? selected : []);

  cards.forEach((card) => {
    const rect = card.getBoundingClientRect();
    const cardRect = {
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      right: rect.right + window.scrollX,
      bottom: rect.bottom + window.scrollY,
    };

    if (rectsIntersect(bandRect, cardRect)) {
      const path = card.dataset.path;
      const file = orderedFiles.find((f) => f.path === path);
      if (file && file.type !== 'dir') {
        newSelected.add(path);
      }
    }
  });

  selected = newSelected;
  notify();
}

function onRbMouseUp() {
  if (rubberBand) {
    rubberBand.remove();
    rubberBand = null;
    rbStart = null;
  }
}

function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}
