import { colName, mid } from './parser.js';

export function initUI(engine) {
  const COLS = 26, ROWS = 50;
  const inp = {};
  let sc = 0, sr = 1;
  let editing = false;
  let rangeMode = false;
  let anchorCol = 0, anchorRow = 1;
  let endCol = 0, endRow = 1;
  let dragging = false;

  const grid = document.getElementById('g');
  const gc = document.getElementById('gc');
  const fb = document.getElementById('fb');
  const aci = document.getElementById('aci');
  const editor = document.getElementById('ed');

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
    fb.value = engine.getData()[ni] || '';
  }

  function highlightRange() {
    for (const id in inp) inp[id].classList.remove('range');
    const c1 = Math.min(anchorCol, endCol), c2 = Math.max(anchorCol, endCol);
    const r1 = Math.min(anchorRow, endRow), r2 = Math.max(anchorRow, endRow);
    for (let c = c1; c <= c2; c++)
      for (let r = r1; r <= r2; r++)
        inp[mid(c, r)]?.classList.add('range');
    rangeMode = (c1 !== c2 || r1 !== r2);
  }

  function selectAll() {
    anchorCol = 0; anchorRow = 1;
    endCol = COLS - 1; endRow = ROWS;
    highlightRange();
  }

  function clearRange() {
    if (!rangeMode) return;
    for (const id in inp) inp[id].classList.remove('range');
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
    editor.value = initial !== undefined ? initial : (engine.getData()[i] || '');
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

  // Subscribe to engine updates
  engine.subscribe(updates => {
    for (const [id, v] of updates) {
      const el = inp[id]; if (!el) continue;
      el.textContent = v === '' ? '' : v;
      el.classList.toggle('err', typeof v === 'string' && v[0] === '#');
    }
  });

  // Events
  grid.addEventListener('mousedown', e => {
    const t = e.target.closest('.cv');
    if (!t) return;
    if (editing) commitEdit();
    const id = t.id.slice(1);
    const c = id.charCodeAt(0) - 65, r = +id.slice(1);
    if (e.shiftKey) {
      endCol = c; endRow = r;
      sc = c; sr = r;
      const ni = mid(c, r);
      aci.textContent = ni;
      fb.value = engine.getData()[ni] || '';
      highlightRange();
    } else {
      selectCell(c, r);
      dragging = true;
    }
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cv');
    if (!t) return;
    const id = t.id.slice(1);
    endCol = id.charCodeAt(0) - 65;
    endRow = +id.slice(1);
    highlightRange();
  });

  document.addEventListener('mouseup', () => { dragging = false; });

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
        navigator.clipboard.writeText(out);
        } else {
        // Single Cell Copy (Copies the raw data/formula)
        const val = engine.getData()[mid(sc, sr)] || '';
        navigator.clipboard.writeText(val);
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
          });
        } else {
          const val = engine.getData()[mid(sc, sr)] || '';
          navigator.clipboard.writeText(val).then(() => {
            engine.pushHistory();
            engine.setCell(mid(sc, sr), '');
            fb.value = '';
          });
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') {
      if (editing) return;
      e.preventDefault(); 
      if(engine.undo()) fb.value = engine.getData()[mid(sc, sr)] || '';
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
        fb.value = engine.getData()[mid(sc, sr)] || '';
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
      fb.value = engine.getData()[mid(sc, sr)] || '';
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

  // Boot UI
  buildGrid();
  selectCell(0, 1);
  gc.focus();
}