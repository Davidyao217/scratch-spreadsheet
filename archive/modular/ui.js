// ui.js — DOM rendering, selection, edit overlay, keyboard + click handling.
// All app state for visible UI lives here. Engine state is imported.

import { mid, colName } from './parser.js';
import { data, cache, setCell, clearAll, init, setOnUpdate } from './engine.js';

const COLS = 26, ROWS = 50;
const inp = {};                // id -> cell DOM element
let sc = 0, sr = 1;            // selected col/row (1-indexed row)
let editing = false;
let rangeMode = false;

const grid = document.getElementById('g');
const gc = document.getElementById('gc');
const fb = document.getElementById('fb');
const aci = document.getElementById('aci');
const editor = document.getElementById('ed');

// === Grid construction ===
function buildGrid() {
  let h = '<div class="cell ch corner"></div>';
  for (let c = 0; c < COLS; c++) h += `<div class="cell ch col">${colName(c)}</div>`;
  for (let r = 1; r <= ROWS; r++) {
    h += `<div class="cell ch row">${r}</div>`;
    for (let c = 0; c < COLS; c++) h += `<div class="cell cv" id="x${mid(c, r)}"></div>`;
  }
  grid.innerHTML = h;
  for (const el of grid.querySelectorAll('.cv')) inp[el.id.slice(1)] = el;
}

// === Selection ===
function selectCell(c, r) {
  clearRange();
  c = Math.max(0, Math.min(c, COLS - 1));
  r = Math.max(1, Math.min(r, ROWS));
  const oi = mid(sc, sr), ni = mid(c, r);
  if (inp[oi]) inp[oi].classList.remove('sel');
  sc = c; sr = r;
  inp[ni].classList.add('sel');
  inp[ni].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  aci.textContent = ni;
  fb.value = data[ni] || '';
}

function selectAll() {
  for (const id in inp) inp[id].classList.add('range');
  rangeMode = true;
}

function clearRange() {
  if (!rangeMode) return;
  for (const id in inp) inp[id].classList.remove('range');
  rangeMode = false;
}

// === Inline editor ===
function startEdit(initial) {
  clearRange();
  const i = mid(sc, sr), el = inp[i];
  const r = el.getBoundingClientRect(), gr = gc.getBoundingClientRect();
  // transform-based positioning avoids layout thrashing on every keystroke
  editor.style.transform = `translate(${r.left - gr.left + gc.scrollLeft}px,${r.top - gr.top + gc.scrollTop}px)`;
  editor.style.top = '0';
  editor.style.left = '0';
  editor.style.width = (r.width + 2) + 'px';
  editor.style.height = (r.height + 2) + 'px';
  editor.style.display = 'block';
  editor.value = initial !== undefined ? initial : (data[i] || '');
  editing = true;
  editor.focus();
  const len = editor.value.length;
  editor.setSelectionRange(len, len);
}

function commitEdit() {
  if (!editing) return;
  setCell(mid(sc, sr), editor.value);
  editor.style.display = 'none';
  editing = false;
  gc.focus();
}

function cancelEdit() {
  if (!editing) return;
  editor.style.display = 'none';
  editing = false;
  gc.focus();
}

// === Engine -> DOM bridge ===
setOnUpdate(updates => {
  for (const [id, v] of updates) {
    const el = inp[id]; if (!el) continue;
    el.textContent = v === '' ? '' : v;
    el.classList.toggle('err', typeof v === 'string' && v[0] === '#');
  }
});

// === Single-listener event delegation on the grid ===
grid.addEventListener('mousedown', e => {
  const t = e.target.closest('.cv');
  if (!t) return;
  if (editing) commitEdit();
  const id = t.id.slice(1);
  selectCell(id.charCodeAt(0) - 65, +id.slice(1));
});

grid.addEventListener('dblclick', e => {
  if (e.target.closest('.cv')) startEdit();
});

// === Keyboard ===
const ARROW_DELTA = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};

document.addEventListener('keydown', e => {
  // Formula-bar focus: leave native text editing intact.
  if (document.activeElement === fb) return;

  const k = e.key;

  // Cmd/Ctrl+A: select all (but only when not editing — let editor's native select-all work).
  if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') {
    if (editing) return;
    e.preventDefault();
    selectAll();
    return;
  }

  // Range-mode bulk delete.
  if (rangeMode && (k === 'Backspace' || k === 'Delete')) {
    e.preventDefault();
    clearAll();
    clearRange();
    fb.value = '';
    return;
  }

  // Arrow keys move the selection — commit any in-progress edit first.
  if (ARROW_DELTA[k]) {
    e.preventDefault();
    const [dc, dr] = ARROW_DELTA[k];
    if (editing) commitEdit();
    selectCell(sc + dc, sr + dr);
    return;
  }

  // While editing: only Enter/Tab/Escape are special — everything else is text input.
  if (editing) {
    if (k === 'Enter') { e.preventDefault(); commitEdit(); selectCell(sc, sr + 1); }
    else if (k === 'Tab') { e.preventDefault(); commitEdit(); selectCell(sc + 1, sr); }
    else if (k === 'Escape') { cancelEdit(); }
    return;
  }

  // Non-editing keyboard.
  if (k === 'Escape') { clearRange(); }
  else if (k === 'Enter') { e.preventDefault(); selectCell(sc, sr + 1); }
  else if (k === 'Tab') { e.preventDefault(); selectCell(sc + 1, sr); }
  else if (k === 'Backspace' || k === 'Delete') { setCell(mid(sc, sr), ''); fb.value = ''; }
  else if (k === 'F2') { e.preventDefault(); startEdit(); }
  else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    startEdit(k);
    e.preventDefault();
  }
});

// Editor mirrors typing to the formula bar.
editor.addEventListener('input', e => { fb.value = e.target.value; });

// Formula bar: live edits, Enter = commit & move down.
fb.addEventListener('input', e => setCell(mid(sc, sr), e.target.value));
fb.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); gc.focus(); selectCell(sc, sr + 1); }
});

// === CSV export ===
document.getElementById('ex').addEventListener('click', () => {
  let mr = 0, mc = 0;
  for (const k in data) if (data[k] !== '') {
    mc = Math.max(mc, k.charCodeAt(0) - 65);
    mr = Math.max(mr, +k.slice(1));
  }
  let csv = '';
  for (let r = 1; r <= mr; r++) {
    const row = [];
    for (let c = 0; c <= mc; c++) {
      const v = cache[mid(c, r)] ?? '';
      row.push('"' + String(v).replace(/"/g, '""') + '"');
    }
    csv += row.join(',') + '\n';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'scratchpad.csv';
  a.click();
});

// === Boot ===
buildGrid();
init({ A1: '100', A2: '250', A3: '=SUM(A1:A2)' });
selectCell(0, 1);
gc.focus();
