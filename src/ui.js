import { colName, mid, parseId } from './parser.js';

export function initUI(engine) {
  // ─── Constants ─────────────────────────────────────────────────────────────
  const COLS = 26, ROWS = 50;
  const DEFAULT_COL_W = 109, DEFAULT_ROW_H = 24;
  const MIN_COL_W = 30, MIN_ROW_H = 16;

  // ─── Grid sizes ────────────────────────────────────────────────────────────
  const colWidths = Array(COLS).fill(DEFAULT_COL_W);
  const rowHeights = Array(ROWS).fill(DEFAULT_ROW_H);
  const inp = {};

  // ─── Selection state ───────────────────────────────────────────────────────
  let sel = { anchor: { col: 0, row: 1 }, cursor: { col: 0, row: 1 } };

  // ─── Edit state ────────────────────────────────────────────────────────────
  let editState = 'GRID_NAVIGATION'; // 'GRID_NAVIGATION' | 'QUICK_ENTRY' | 'DEEP_EDIT'
  let isCaretPristine = false;
  let fbPushed = false;

  // ─── Formula range state (null when inactive) ──────────────────────────────
  let formulaRange = null;

  // ─── Resize state (null when inactive) ────────────────────────────────────
  let resize = null;

  // ─── Drag state ───────────────────────────────────────────────────────────
  let dragging = false;

  // ─── Render tracking ──────────────────────────────────────────────────────
  let prevAnchorId = null;
  let rangeSet = new Set();
  let formulaSet = new Set();

  // ─── DOM references ───────────────────────────────────────────────────────
  const grid = document.getElementById('g');
  const gc = document.getElementById('gc');
  const fb = document.getElementById('fb');
  const aci = document.getElementById('aci');
  const editor = document.getElementById('ed');
  const infoModal = document.getElementById('info-modal');

  const rb = document.createElement('div');
  rb.id = 'rb';
  grid.appendChild(rb);

  const frb = document.createElement('div');
  frb.id = 'frb';
  grid.appendChild(frb);

  // ─── Grid construction ─────────────────────────────────────────────────────
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

  // ─── Selection API ─────────────────────────────────────────────────────────
  function clampCol(c) { return Math.max(0, Math.min(c, COLS - 1)); }
  function clampRow(r) { return Math.max(1, Math.min(r, ROWS)); }

  function renderSelection() {
    if (prevAnchorId && inp[prevAnchorId]) inp[prevAnchorId].classList.remove('sel');
    const anchorId = mid(sel.anchor.col, sel.anchor.row);
    prevAnchorId = anchorId;
    if (inp[anchorId]) inp[anchorId].classList.add('sel');

    for (const id of rangeSet) inp[id]?.classList.remove('range');
    rangeSet.clear();

    const isRange = sel.anchor.col !== sel.cursor.col || sel.anchor.row !== sel.cursor.row;
    if (isRange) {
      const { c1, c2, r1, r2 } = getSelectionBounds();
      for (let c = c1; c <= c2; c++)
        for (let r = r1; r <= r2; r++) {
          const id = mid(c, r);
          rangeSet.add(id);
          inp[id]?.classList.add('range');
        }
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

  function setSelection(anchor, cursor) {
    if (cursor === undefined) cursor = anchor;
    sel = {
      anchor: { col: clampCol(anchor.col), row: clampRow(anchor.row) },
      cursor: { col: clampCol(cursor.col), row: clampRow(cursor.row) },
    };
    renderSelection();
    const anchorId = mid(sel.anchor.col, sel.anchor.row);
    aci.textContent = anchorId;
    fb.value = engine.getData()[anchorId] ?? '';
    inp[mid(sel.cursor.col, sel.cursor.row)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function getSelectionBounds() {
    return {
      c1: Math.min(sel.anchor.col, sel.cursor.col),
      c2: Math.max(sel.anchor.col, sel.cursor.col),
      r1: Math.min(sel.anchor.row, sel.cursor.row),
      r2: Math.max(sel.anchor.row, sel.cursor.row),
    };
  }

  // ─── Formula range highlight ───────────────────────────────────────────────
  function renderFormulaRange(anchor, cursor) {
    clearFormulaRange();
    const c1 = Math.min(anchor.col, cursor.col), c2 = Math.max(anchor.col, cursor.col);
    const r1 = Math.min(anchor.row, cursor.row), r2 = Math.max(anchor.row, cursor.row);
    for (let c = c1; c <= c2; c++)
      for (let r = r1; r <= r2; r++) {
        const id = mid(c, r);
        formulaSet.add(id);
        inp[id]?.classList.add('formula-ref');
      }
    const tl = inp[mid(c1, r1)], br = inp[mid(c2, r2)];
    if (tl && br) {
      frb.style.left = tl.offsetLeft + 'px';
      frb.style.top = tl.offsetTop + 'px';
      frb.style.width = (br.offsetLeft + br.offsetWidth - tl.offsetLeft) + 'px';
      frb.style.height = (br.offsetTop + br.offsetHeight - tl.offsetTop) + 'px';
      frb.style.display = 'block';
    }
  }

  function clearFormulaRange() {
    for (const id of formulaSet) inp[id]?.classList.remove('formula-ref');
    formulaSet.clear();
    frb.style.display = 'none';
  }

  // ─── Edit ──────────────────────────────────────────────────────────────────
  function startEdit(initial) {
    const anchorId = mid(sel.anchor.col, sel.anchor.row);
    const el = inp[anchorId];
    const r = el.getBoundingClientRect(), gr = gc.getBoundingClientRect();
    editor.style.transform = `translate(${r.left - gr.left + gc.scrollLeft}px,${r.top - gr.top + gc.scrollTop}px)`;
    editor.style.top = '0';
    editor.style.left = '0';
    editor.style.width = (r.width + 2) + 'px';
    editor.style.height = (r.height + 2) + 'px';
    editor.style.display = 'block';
    const val = initial !== undefined ? initial : (engine.getData()[anchorId] ?? '');
    editor.value = val;
    fb.value = val;
    if (initial !== undefined) {
      editState = 'QUICK_ENTRY';
      isCaretPristine = true;
    } else {
      editState = 'DEEP_EDIT';
      isCaretPristine = false;
    }
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
  }

  function commitEdit() {
    if (editState === 'GRID_NAVIGATION') return;
    clearFormulaRange();
    formulaRange = null;
    const anchorId = mid(sel.anchor.col, sel.anchor.row);
    engine.pushHistory();
    engine.setCell(anchorId, editor.value);
    editor.style.display = 'none';
    editState = 'GRID_NAVIGATION';
    isCaretPristine = false;
    gc.focus();
  }

  function cancelEdit() {
    if (editState === 'GRID_NAVIGATION') return;
    clearFormulaRange();
    formulaRange = null;
    const anchorId = mid(sel.anchor.col, sel.anchor.row);
    editor.style.display = 'none';
    editState = 'GRID_NAVIGATION';
    isCaretPristine = false;
    gc.focus();
    fb.value = engine.getData()[anchorId] ?? '';
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function isFormulaInsertPosition(input) {
    const val = input.value;
    if (!val.startsWith('=')) return false;
    const before = val.slice(0, input.selectionStart).trimEnd();
    if (!before.length) return false;
    const last = before[before.length - 1];
    return '(,=+-*/^%&<>'.includes(last);
  }

  function rangeRef(anchor, cursor) {
    if (anchor.col === cursor.col && anchor.row === cursor.row) return mid(anchor.col, anchor.row);
    const c1 = Math.min(anchor.col, cursor.col), c2 = Math.max(anchor.col, cursor.col);
    const r1 = Math.min(anchor.row, cursor.row), r2 = Math.max(anchor.row, cursor.row);
    return mid(c1, r1) + ':' + mid(c2, r2);
  }

  function serializeRange(c1, r1, c2, r2) {
    const cache = engine.getCache();
    let out = '';
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) row.push(cache[mid(c, r)] ?? '');
      out += row.join('\t') + '\n';
    }
    return out;
  }

  function insertFormulaRef(ref) {
    const { input, insertPos, prevRefLen } = formulaRange;
    const val = input.value;
    const newVal = val.slice(0, insertPos) + ref + val.slice(insertPos + prevRefLen);
    input.value = newVal;
    formulaRange.prevRefLen = ref.length;
    const cur = insertPos + ref.length;
    input.setSelectionRange(cur, cur);
    if (input === editor) fb.value = newVal;
    else if (input === fb && editState !== 'GRID_NAVIGATION') editor.value = newVal;
  }

  // ─── Engine subscriber ─────────────────────────────────────────────────────
  engine.subscribe(updates => {
    for (const [id, v] of updates) {
      const el = inp[id]; if (!el) continue;
      el.textContent = v === '' ? '' : v;
      el.classList.toggle('err', typeof v === 'string' && v[0] === '#');
    }
  });

  // ─── Hotkeys ───────────────────────────────────────────────────────────────
  function handleHotkey(e) {
    const k = e.key.toLowerCase();

    if (k === 's') {
      e.preventDefault();
      document.getElementById('sv').click();
      return true;
    }

    if (k === 'c') {
      if (editState !== 'GRID_NAVIGATION') return false;
      e.preventDefault();
      const isRange = sel.anchor.col !== sel.cursor.col || sel.anchor.row !== sel.cursor.row;
      const { c1, c2, r1, r2 } = getSelectionBounds();
      const text = isRange
        ? serializeRange(c1, r1, c2, r2)
        : (engine.getData()[mid(sel.anchor.col, sel.anchor.row)] ?? '');
      navigator.clipboard.writeText(text).catch(err => console.error('Clipboard error', err));
      return true;
    }

    if (k === 'x') {
      if (editState !== 'GRID_NAVIGATION') return false;
      e.preventDefault();
      const isRange = sel.anchor.col !== sel.cursor.col || sel.anchor.row !== sel.cursor.row;
      const { c1, c2, r1, r2 } = getSelectionBounds();
      const text = isRange
        ? serializeRange(c1, r1, c2, r2)
        : (engine.getData()[mid(sel.anchor.col, sel.anchor.row)] ?? '');
      navigator.clipboard.writeText(text).then(() => {
        engine.pushHistory();
        for (let r = r1; r <= r2; r++)
          for (let c = c1; c <= c2; c++)
            engine.setCell(mid(c, r), '');
        setSelection(sel.anchor, sel.anchor);
      }).catch(err => console.error('Clipboard error', err));
      return true;
    }

    if (k === 'z') {
      if (editState !== 'GRID_NAVIGATION') return false;
      e.preventDefault();
      if (engine.undo()) fb.value = engine.getData()[mid(sel.anchor.col, sel.anchor.row)] ?? '';
      return true;
    }

    if (k === 'a') {
      if (editState !== 'GRID_NAVIGATION') return false;
      e.preventDefault();
      setSelection({ col: 0, row: 1 }, { col: COLS - 1, row: ROWS });
      return true;
    }

    if (k === 'i') {
      e.preventDefault();
      infoModal.hidden = !infoModal.hidden;
      if (infoModal.hidden) gc.focus();
      return true;
    }

    return false;
  }

  // ─── Event listeners ───────────────────────────────────────────────────────
  const ARROW_DELTA = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };

  grid.addEventListener('mousedown', e => {
    const colHandle = e.target.closest('[data-resize-col]');
    if (colHandle) {
      e.preventDefault();
      e.stopPropagation();
      const index = +colHandle.dataset.resizeCol;
      resize = { type: 'col', index, startPos: e.clientX, origSize: colWidths[index] };
      colHandle.classList.add('active');
      document.body.classList.add('col-resizing');
      return;
    }
    const rowHandle = e.target.closest('[data-resize-row]');
    if (rowHandle) {
      e.preventDefault();
      e.stopPropagation();
      const index = +rowHandle.dataset.resizeRow;
      resize = { type: 'row', index, startPos: e.clientY, origSize: rowHeights[index - 1] };
      rowHandle.classList.add('active');
      document.body.classList.add('row-resizing');
      return;
    }

    const t = e.target.closest('.cv');
    if (!t) return;
    const [c, r] = parseId(t.id.slice(1));

    const activeInput = editState !== 'GRID_NAVIGATION' ? editor : (document.activeElement === fb ? fb : null);
    if (activeInput && isFormulaInsertPosition(activeInput)) {
      e.preventDefault();
      formulaRange = {
        input: activeInput,
        insertPos: activeInput.selectionStart,
        prevRefLen: 0,
        anchor: { col: c, row: r },
        cursor: { col: c, row: r },
      };
      insertFormulaRef(mid(c, r));
      renderFormulaRange({ col: c, row: r }, { col: c, row: r });
      return;
    }

    if (editState !== 'GRID_NAVIGATION') commitEdit();
    if (e.shiftKey) {
      setSelection(sel.anchor, { col: c, row: r });
    } else {
      setSelection({ col: c, row: r });
      dragging = true;
    }
  });

  document.addEventListener('mousemove', e => {
    if (resize !== null) {
      const delta = resize.type === 'col'
        ? e.clientX - resize.startPos
        : e.clientY - resize.startPos;
      if (resize.type === 'col') colWidths[resize.index] = Math.max(MIN_COL_W, resize.origSize + delta);
      else rowHeights[resize.index - 1] = Math.max(MIN_ROW_H, resize.origSize + delta);
      updateGridTemplate();
      return;
    }

    if (formulaRange !== null) {
      const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cv');
      if (!t) return;
      const [c, r] = parseId(t.id.slice(1));
      formulaRange.cursor = { col: c, row: r };
      insertFormulaRef(rangeRef(formulaRange.anchor, { col: c, row: r }));
      renderFormulaRange(formulaRange.anchor, { col: c, row: r });
      return;
    }

    if (!dragging) return;
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cv');
    if (!t) return;
    const [c, r] = parseId(t.id.slice(1));
    setSelection(sel.anchor, { col: c, row: r });
  });

  document.addEventListener('mouseup', () => {
    if (resize !== null) {
      document.querySelectorAll('.col-resize-handle.active, .row-resize-handle.active')
        .forEach(el => el.classList.remove('active'));
      document.body.classList.remove('col-resizing', 'row-resizing');
      resize = null;
      return;
    }
    if (formulaRange !== null) {
      const { input, insertPos, prevRefLen } = formulaRange;
      clearFormulaRange();
      formulaRange = null;
      input.focus();
      input.setSelectionRange(insertPos + prevRefLen, insertPos + prevRefLen);
      return;
    }
    dragging = false;
  });

  grid.addEventListener('dblclick', e => {
    if (e.target.closest('.cv')) startEdit();
  });

  document.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (!infoModal.hidden) {
      if (e.key === 'Escape') { infoModal.hidden = true; gc.focus(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); infoModal.hidden = true; gc.focus(); }
      return;
    }
    if (document.activeElement === fb || document.activeElement.id === 'file-title') return;

    const k = e.key;

    if ((e.ctrlKey || e.metaKey) && handleHotkey(e)) return;

    if (k === 'Backspace' || k === 'Delete') {
      if (editState !== 'GRID_NAVIGATION') {
        if (formulaRange !== null) { clearFormulaRange(); formulaRange = null; }
        return;
      }
      e.preventDefault();
      engine.pushHistory();
      const { c1, c2, r1, r2 } = getSelectionBounds();
      for (let r = r1; r <= r2; r++)
        for (let c = c1; c <= c2; c++)
          engine.setCell(mid(c, r), '');
      setSelection(sel.anchor, sel.anchor);
      return;
    }

    if (ARROW_DELTA[k]) {
      const [dc, dr] = ARROW_DELTA[k];

      if (editState === 'GRID_NAVIGATION') {
        e.preventDefault();
        if (e.shiftKey) {
          setSelection(sel.anchor, { col: sel.cursor.col + dc, row: sel.cursor.row + dr });
        } else {
          setSelection({ col: sel.anchor.col + dc, row: sel.anchor.row + dr });
        }
        return;
      }

      // Formula pointing: continue if already pointing, or start if at a formula-insert position
      if (formulaRange !== null || isFormulaInsertPosition(editor)) {
        e.preventDefault();
        if (formulaRange === null) {
          let fAnchor, fCursor;
          if (e.shiftKey) {
            fAnchor = { col: sel.anchor.col, row: sel.anchor.row };
            fCursor = { col: clampCol(sel.anchor.col + dc), row: clampRow(sel.anchor.row + dr) };
          } else {
            fAnchor = { col: clampCol(sel.anchor.col + dc), row: clampRow(sel.anchor.row + dr) };
            fCursor = { ...fAnchor };
          }
          formulaRange = { input: editor, insertPos: editor.selectionStart, prevRefLen: 0, anchor: fAnchor, cursor: fCursor };
        } else {
          if (e.shiftKey) {
            formulaRange.cursor = { col: clampCol(formulaRange.cursor.col + dc), row: clampRow(formulaRange.cursor.row + dr) };
          } else {
            const next = { col: clampCol(formulaRange.anchor.col + dc), row: clampRow(formulaRange.anchor.row + dr) };
            formulaRange.anchor = next;
            formulaRange.cursor = next;
          }
        }
        const ref = rangeRef(formulaRange.anchor, formulaRange.cursor);
        insertFormulaRef(ref);
        renderFormulaRange(formulaRange.anchor, formulaRange.cursor);
        return;
      }

      if (e.shiftKey) {
        isCaretPristine = false;
        return;
      }

      if (editState === 'QUICK_ENTRY' && isCaretPristine) {
        e.preventDefault();
        const { col, row } = sel.anchor;
        commitEdit();
        setSelection({ col: col + dc, row: row + dr });
        return;
      }

      isCaretPristine = false;
      return;
    }

    if (editState !== 'GRID_NAVIGATION') {
      if (formulaRange !== null && k !== 'Shift' && k !== 'Control' && k !== 'Meta' && k !== 'Alt') {
        clearFormulaRange();
        formulaRange = null;
      }
      if (k === 'Enter') {
        e.preventDefault();
        const { col, row } = sel.anchor;
        commitEdit();
        setSelection({ col, row: row + 1 });
      } else if (k === 'Tab') {
        e.preventDefault();
        const { col, row } = sel.anchor;
        commitEdit();
        if (e.shiftKey) setSelection({ col: col - 1, row });
        else setSelection({ col: col + 1, row });
      } else if (k === 'Escape') {
        cancelEdit();
      }
      return;
    }

    if (k === 'Escape') {
      setSelection(sel.anchor, sel.anchor);
    } else if (k === 'Enter') {
      e.preventDefault();
      startEdit();
    } else if (k === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) setSelection({ col: sel.anchor.col - 1, row: sel.anchor.row });
      else setSelection({ col: sel.anchor.col + 1, row: sel.anchor.row });
    } else if (k === 'F2') {
      e.preventDefault();
      startEdit();
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEdit(k);
      e.preventDefault();
    }
  });

  document.addEventListener('paste', e => {
    if (editState !== 'GRID_NAVIGATION' || document.activeElement === fb || document.activeElement === editor || document.activeElement.id === 'file-title') return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    engine.pushHistory();
    const rows = text.split(/\r?\n/).filter(r => r.length > 0);
    if (rows.length === 1 && !rows[0].includes('\t')) {
      const anchorId = mid(sel.anchor.col, sel.anchor.row);
      engine.setCell(anchorId, text);
      fb.value = text;
    } else {
      for (let dr = 0; dr < rows.length; dr++) {
        const cols = rows[dr].split('\t');
        for (let dc = 0; dc < cols.length; dc++) {
          const tc = sel.anchor.col + dc, tr = sel.anchor.row + dr;
          if (tc < COLS && tr <= ROWS)
            engine.setCell(mid(tc, tr), cols[dc]);
        }
      }
      fb.value = engine.getData()[mid(sel.anchor.col, sel.anchor.row)] ?? '';
    }
  });

  editor.addEventListener('input', e => { fb.value = e.target.value; });

  document.addEventListener('selectionchange', () => {
    if (editState === 'QUICK_ENTRY' && document.activeElement === editor) {
      const atEnd = editor.selectionStart === editor.value.length
                    && editor.selectionEnd === editor.value.length;
      if (!atEnd) isCaretPristine = false;
    }
  });

  fb.addEventListener('focus', () => { fbPushed = false; });
  fb.addEventListener('input', e => {
    if (!fbPushed) { engine.pushHistory(); fbPushed = true; }
    engine.setCell(mid(sel.anchor.col, sel.anchor.row), e.target.value);
  });
  fb.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const { col, row } = sel.anchor;
      gc.focus();
      setSelection({ col, row: row + 1 });
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      document.getElementById('sv').click();
    }
  });

  document.getElementById('file-title').addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); gc.focus(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); document.getElementById('sv').click(); }
  });

  document.getElementById('info-btn').addEventListener('click', () => { infoModal.hidden = false; });
  document.getElementById('info-close').addEventListener('click', () => { infoModal.hidden = true; gc.focus(); });
  infoModal.addEventListener('click', e => {
    if (e.target === infoModal) { infoModal.hidden = true; gc.focus(); }
  });

  // ─── Boot ──────────────────────────────────────────────────────────────────
  buildGrid();
  setSelection({ col: 0, row: 1 });
  gc.focus();
}
