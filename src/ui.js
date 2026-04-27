import { colName, mid, parseId } from './parser.js';

export function initUI(engine) {
  const COLS = 26, ROWS = 50;
  const DEFAULT_COL_W = 109, DEFAULT_ROW_H = 24;
  const MIN_COL_W = 30, MIN_ROW_H = 16;
  const colWidths = Array(COLS).fill(DEFAULT_COL_W);
  const rowHeights = Array(ROWS).fill(DEFAULT_ROW_H);
  const inp = {};
  let sc = 0, sr = 1;
  let editing = false;
  let rangeMode = false;
  let anchorCol = 0, anchorRow = 1;
  let endCol = 0, endRow = 1;
  let dragging = false;

  // Resize state
  let resizeType = null;   // 'col' | 'row' | null
  let resizeIndex = -1;
  let resizeStart = 0;
  let resizeOrigSize = 0;

  // Formula range selection state
  let formulaRangeMode = false;
  let formulaInsertPos = 0;
  let formulaPrevRefLen = 0;
  let formulaActiveInput = null;
  let formulaDragAnchorCol = 0;
  let formulaDragAnchorRow = 1;

  const grid = document.getElementById('g');
  const gc = document.getElementById('gc');
  const fb = document.getElementById('fb');
  const aci = document.getElementById('aci');
  const editor = document.getElementById('ed');

  // Range border overlay
  const rb = document.createElement('div');
  rb.id = 'rb';
  grid.appendChild(rb);

  const frb = document.createElement('div');
  frb.id = 'frb';
  grid.appendChild(frb);

  function updateGridTemplate() {
    grid.style.gridTemplateColumns = '40px ' + colWidths.map(w => w + 'px').join(' ');
    grid.style.gridTemplateRows = 'auto ' + rowHeights.map(h => h + 'px').join(' ');
  }

  function buildGrid() {
    let h = '<div class="cell ch corner"></div>';
    for (let c = 0; c < COLS; c++)
      h += `<div class="cell ch col" data-col="${c}">${colName(c)}<div class="col-resize-handle" data-resize-col="${c}"></div></div>`;
    for (let r = 1; r <= ROWS; r++) {
      h += `<div class="cell ch row" data-row="${r}">${r}<div class="row-resize-handle" data-resize-row="${r}"></div></div>`;
      for (let c = 0; c < COLS; c++) h += `<div class="cell cv" id="x${mid(c, r)}"></div>`;
    }
    grid.innerHTML = h;
    grid.appendChild(rb);
    grid.appendChild(frb);
    for (const el of grid.querySelectorAll('.cv')) inp[el.id.slice(1)] = el;
    updateGridTemplate();
  }

  function selectCell(c, r) {
    clearRange();
    c = Math.max(0, Math.min(c, COLS - 1));
    r = Math.max(1, Math.min(r, ROWS));
    const oi = mid(sc, sr), ni = mid(c, r);
    if (inp[oi]) inp[oi].classList.remove('sel');
    sc = c; sr = r;
    anchorCol = endCol = c;
    anchorRow = endRow = r;
    inp[ni].classList.add('sel');
    inp[ni].scrollIntoView({ block: 'nearest', inline: 'nearest' });
    aci.textContent = ni;
    fb.value = engine.getData()[ni] ?? '';
  }

  function highlightRange() {
    for (const id in inp) inp[id].classList.remove('range');
    const c1 = Math.min(anchorCol, endCol), c2 = Math.max(anchorCol, endCol);
    const r1 = Math.min(anchorRow, endRow), r2 = Math.max(anchorRow, endRow);
    rangeMode = (c1 !== c2 || r1 !== r2);
    if (rangeMode) {
      for (let c = c1; c <= c2; c++)
        for (let r = r1; r <= r2; r++)
          inp[mid(c, r)]?.classList.add('range');
      const tl = inp[mid(c1, r1)], br = inp[mid(c2, r2)];
      if (tl && br) {
        rb.style.left = tl.offsetLeft + 'px';
        rb.style.top = tl.offsetTop + 'px';
        rb.style.width = (br.offsetLeft + br.offsetWidth - tl.offsetLeft) + 'px';
        rb.style.height = (br.offsetTop + br.offsetHeight - tl.offsetTop) + 'px';
        rb.style.display = 'block';
      }
    } else {
      rb.style.display = 'none';
    }
  }

  function selectAll() {
    anchorCol = 0; anchorRow = 1;
    endCol = COLS - 1; endRow = ROWS;
    highlightRange();
  }

  function clearRange() {
    for (const id in inp) inp[id].classList.remove('range');
    rb.style.display = 'none';
    rangeMode = false;
  }

  function startEdit(initial) {
    clearRange();
    const i = mid(sc, sr), el = inp[i];
    const r = el.getBoundingClientRect(), gr = gc.getBoundingClientRect();
    editor.style.transform = `translate(${r.left - gr.left + gc.scrollLeft}px,${r.top - gr.top + gc.scrollTop}px)`;
    editor.style.top = '0';
    editor.style.left = '0';
    editor.style.width = (r.width + 2) + 'px';
    editor.style.height = (r.height + 2) + 'px';
    editor.style.display = 'block';
    editor.value = initial !== undefined ? initial : (engine.getData()[i] ?? '');
    editing = true;
    editor.focus();
    const len = editor.value.length;
    editor.setSelectionRange(len, len);
  }

  function commitEdit() {
    if (!editing) return;
    engine.pushHistory();
    engine.setCell(mid(sc, sr), editor.value);
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

  // --- Formula range selection helpers ---
  function isFormulaInsertPosition(input) {
    const val = input.value;
    if (!val.startsWith('=')) return false;
    const before = val.slice(0, input.selectionStart).trimEnd();
    if (!before.length) return false;
    const last = before[before.length - 1];
    return last === '(' || last === ',';
  }

  function buildRangeRef(c1, r1, c2, r2) {
    if (c1 === c2 && r1 === r2) return mid(c1, r1);
    return mid(Math.min(c1, c2), Math.min(r1, r2)) + ':' + mid(Math.max(c1, c2), Math.max(r1, r2));
  }

  function insertFormulaRef(ref) {
    const input = formulaActiveInput;
    const val = input.value;
    const newVal = val.slice(0, formulaInsertPos) + ref + val.slice(formulaInsertPos + formulaPrevRefLen);
    input.value = newVal;
    formulaPrevRefLen = ref.length;
    const cur = formulaInsertPos + ref.length;
    input.setSelectionRange(cur, cur);
    if (input === editor) fb.value = newVal;
    else if (input === fb && editing) editor.value = newVal;
  }

  function highlightFormulaRange(c1, r1, c2, r2) {
    clearFormulaHighlight();
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    for (let c = minC; c <= maxC; c++)
      for (let r = minR; r <= maxR; r++)
        inp[mid(c, r)]?.classList.add('formula-ref');
    
    const tl = inp[mid(minC, minR)], br = inp[mid(maxC, maxR)];
    if (tl && br) {
      frb.style.left = tl.offsetLeft + 'px';
      frb.style.top = tl.offsetTop + 'px';
      frb.style.width = (br.offsetLeft + br.offsetWidth - tl.offsetLeft) + 'px';
      frb.style.height = (br.offsetTop + br.offsetHeight - tl.offsetTop) + 'px';
      frb.style.display = 'block';
    }
  }

  function clearFormulaHighlight() {
    for (const id in inp) inp[id].classList.remove('formula-ref');
    frb.style.display = 'none';
  }

  // Subscribe to engine updates
  engine.subscribe(updates => {
    for (const [id, v] of updates) {
      const el = inp[id]; if (!el) continue;
      el.textContent = v === '' ? '' : v;
      el.classList.toggle('err', typeof v === 'string' && v[0] === '#');
    }
  });

  // --- Resize event handlers ---
  grid.addEventListener('mousedown', e => {
    // Column resize handle
    const colHandle = e.target.closest('[data-resize-col]');
    if (colHandle) {
      e.preventDefault();
      e.stopPropagation();
      resizeType = 'col';
      resizeIndex = +colHandle.dataset.resizeCol;
      resizeStart = e.clientX;
      resizeOrigSize = colWidths[resizeIndex];
      colHandle.classList.add('active');
      document.body.classList.add('col-resizing');
      return;
    }
    // Row resize handle
    const rowHandle = e.target.closest('[data-resize-row]');
    if (rowHandle) {
      e.preventDefault();
      e.stopPropagation();
      resizeType = 'row';
      resizeIndex = +rowHandle.dataset.resizeRow;
      resizeStart = e.clientY;
      resizeOrigSize = rowHeights[resizeIndex - 1];
      rowHandle.classList.add('active');
      document.body.classList.add('row-resizing');
      return;
    }

    const t = e.target.closest('.cv');
    if (!t) return;
    const id = t.id.slice(1);
    const [c, r] = parseId(id);

    // Formula range selection: insert cell ref instead of navigating
    const activeInput = editing ? editor : (document.activeElement === fb ? fb : null);
    if (activeInput && isFormulaInsertPosition(activeInput)) {
      e.preventDefault();
      formulaRangeMode = true;
      formulaActiveInput = activeInput;
      formulaInsertPos = activeInput.selectionStart;
      formulaPrevRefLen = 0;
      formulaDragAnchorCol = c;
      formulaDragAnchorRow = r;
      insertFormulaRef(mid(c, r));
      highlightFormulaRange(c, r, c, r);
      return;
    }

    if (editing) commitEdit();
    if (e.shiftKey) {
      endCol = c; endRow = r;
      sc = c; sr = r;
      const ni = mid(c, r);
      aci.textContent = ni;
      fb.value = engine.getData()[ni] ?? '';
      highlightRange();
    } else {
      selectCell(c, r);
      dragging = true;
    }
  });

  document.addEventListener('mousemove', e => {
    // Handle resize drag
    if (resizeType === 'col') {
      const delta = e.clientX - resizeStart;
      colWidths[resizeIndex] = Math.max(MIN_COL_W, resizeOrigSize + delta);
      updateGridTemplate();
      return;
    }
    if (resizeType === 'row') {
      const delta = e.clientY - resizeStart;
      rowHeights[resizeIndex - 1] = Math.max(MIN_ROW_H, resizeOrigSize + delta);
      updateGridTemplate();
      return;
    }

    if (formulaRangeMode) {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cv');
      if (!t) return;
      const id = t.id.slice(1);
      const [c, r] = parseId(id);
      insertFormulaRef(buildRangeRef(formulaDragAnchorCol, formulaDragAnchorRow, c, r));
      highlightFormulaRange(formulaDragAnchorCol, formulaDragAnchorRow, c, r);
      return;
    }
    if (!dragging) return;
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cv');
    if (!t) return;
    const id = t.id.slice(1);
    const [c, r] = parseId(id);
    endCol = c;
    endRow = r;
    highlightRange();
  });

  document.addEventListener('mouseup', () => {
    if (resizeType) {
      document.querySelectorAll('.col-resize-handle.active, .row-resize-handle.active')
        .forEach(el => el.classList.remove('active'));
      document.body.classList.remove('col-resizing', 'row-resizing');
      resizeType = null;
      return;
    }
    if (formulaRangeMode) {
      formulaRangeMode = false;
      clearFormulaHighlight();
      formulaActiveInput.focus();
      const cur = formulaInsertPos + formulaPrevRefLen;
      formulaActiveInput.setSelectionRange(cur, cur);
      return;
    }
    dragging = false;
  });

  grid.addEventListener('dblclick', e => {
    if (e.target.closest('.cv')) startEdit();
  });

  const ARROW_DELTA = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  document.addEventListener('keydown', e => {
    if (document.activeElement === fb) return;
    const k = e.key;

    // Handle Copy (Cmd/Ctrl + C)
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
      if (editing) return; // Let native copy work if editing text
      e.preventDefault();

      if (rangeMode) {
        // Range Copy
        const c1 = Math.min(anchorCol, endCol), c2 = Math.max(anchorCol, endCol);
        const r1 = Math.min(anchorRow, endRow), r2 = Math.max(anchorRow, endRow);
        const cache = engine.getCache();
        let out = '';
        for (let r = r1; r <= r2; r++) {
          const row = [];
          for (let c = c1; c <= c2; c++) row.push(cache[mid(c, r)] ?? '');
          out += row.join('\t') + '\n';
        }
        navigator.clipboard.writeText(out).catch(e => console.error('Clipboard error', e));
      } else {
        // Single Cell Copy (Copies the raw data/formula)
        const val = engine.getData()[mid(sc, sr)] ?? '';
        navigator.clipboard.writeText(val).catch(e => console.error('Clipboard error', e));
      }
      return;
    }

    // Handle Cut (Cmd/Ctrl + X)
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'x') {
      if (editing) return;
      e.preventDefault();
      if (rangeMode) {
        const c1 = Math.min(anchorCol, endCol), c2 = Math.max(anchorCol, endCol);
        const r1 = Math.min(anchorRow, endRow), r2 = Math.max(anchorRow, endRow);
        const cache = engine.getCache();
        let out = '';
        for (let r = r1; r <= r2; r++) {
          const row = [];
          for (let c = c1; c <= c2; c++) row.push(cache[mid(c, r)] ?? '');
          out += row.join('\t') + '\n';
        }
        navigator.clipboard.writeText(out).then(() => {
          engine.pushHistory();
          for (let r = r1; r <= r2; r++)
            for (let c = c1; c <= c2; c++)
              engine.setCell(mid(c, r), '');
          clearRange();
          fb.value = '';
        }).catch(e => console.error('Clipboard error', e));
      } else {
        const val = engine.getData()[mid(sc, sr)] ?? '';
        navigator.clipboard.writeText(val).then(() => {
          engine.pushHistory();
          engine.setCell(mid(sc, sr), '');
          fb.value = '';
        }).catch(e => console.error('Clipboard error', e));
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      if (editing) return;
      e.preventDefault();
      if (engine.undo()) fb.value = engine.getData()[mid(sc, sr)] ?? '';
      return;
    }

    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'a') {
      if (editing) return;
      e.preventDefault(); selectAll(); return;
    }

    if (rangeMode && (k === 'Backspace' || k === 'Delete')) {
      e.preventDefault();
      engine.pushHistory();
      const c1 = Math.min(anchorCol, endCol), c2 = Math.max(anchorCol, endCol);
      const r1 = Math.min(anchorRow, endRow), r2 = Math.max(anchorRow, endRow);
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          engine.setCell(mid(c, r), '');
      clearRange();
      fb.value = '';
      return;
    }

    if (ARROW_DELTA[k]) {
      e.preventDefault();
      const [dc, dr] = ARROW_DELTA[k];
      if (editing) commitEdit();
      if (e.shiftKey) {
        endCol = Math.max(0, Math.min(endCol + dc, COLS - 1));
        endRow = Math.max(1, Math.min(endRow + dr, ROWS));
        sc = endCol; sr = endRow;
        inp[mid(sc, sr)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        aci.textContent = mid(sc, sr);
        fb.value = engine.getData()[mid(sc, sr)] ?? '';
        highlightRange();
      } else {
        selectCell(sc + dc, sr + dr);
      }
      return;
    }

    if (editing) {
      if (k === 'Enter') { e.preventDefault(); commitEdit(); selectCell(sc, sr + 1); }
      else if (k === 'Tab') { e.preventDefault(); commitEdit(); selectCell(sc + 1, sr); }
      else if (k === 'Escape') { cancelEdit(); }
      return;
    }

    if (k === 'Escape') { clearRange(); }
    else if (k === 'Enter') { e.preventDefault(); startEdit(); }
    else if (k === 'Tab') { e.preventDefault(); selectCell(sc + 1, sr); }
    else if (k === 'Backspace' || k === 'Delete') { engine.pushHistory(); engine.setCell(mid(sc, sr), ''); fb.value = ''; }
    else if (k === 'F2') { e.preventDefault(); startEdit(); }
    else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEdit(k); e.preventDefault();
    }
  });

  document.addEventListener('paste', e => {
    if (editing || document.activeElement === fb || document.activeElement === editor) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    engine.pushHistory();
    const rows = text.split('\n').filter(r => r.length > 0);
    if (rows.length === 1 && !rows[0].includes('\t')) {
      engine.setCell(mid(sc, sr), text);
      fb.value = text;
    } else {
      for (let dr = 0; dr < rows.length; dr++) {
        const cols = rows[dr].split('\t');
        for (let dc = 0; dc < cols.length; dc++) {
          const tc = sc + dc, tr = sr + dr;
          if (tc < COLS && tr <= ROWS)
            engine.setCell(mid(tc, tr), cols[dc]);
        }
      }
      fb.value = engine.getData()[mid(sc, sr)] ?? '';
    }
  });

  editor.addEventListener('input', e => { fb.value = e.target.value; });

  fb.addEventListener('focus', engine.pushHistory);
  fb.addEventListener('input', e => engine.setCell(mid(sc, sr), e.target.value));
  fb.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); gc.focus(); selectCell(sc, sr + 1); }
  });

  document.getElementById('ex').addEventListener('click', () => {
    let mr = 0, mc = 0;
    const data = engine.getData(), cache = engine.getCache();
    for (const k in data) if (data[k] !== '') {
      const [c, r] = parseId(k);
      mc = Math.max(mc, c);
      mr = Math.max(mr, r);
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

  // Boot UI
  buildGrid();
  selectCell(0, 1);
  gc.focus();
}