# `ui.js` Rewrite Spec

## Purpose

`initUI(engine)` is the sole UI module. It builds the grid DOM, wires all user interaction, and keeps the visual state in sync with the engine. It exports nothing — all behavior is self-contained within the call.

---

## Design philosophy

The rewrite has one overriding goal: **every logical concern has exactly one place in the code that owns it.** This is not just a style preference — the existing bugs (stale `sel` class after Ctrl+A, history pushed on every focus, range class leaked across interactions) all trace directly to state being mutated in multiple uncoordinated places.

Concrete mandates:

- **All selection mutations go through one function.** No event handler reaches into selection state directly. There is one entry point (`setSelection`) and it is the only place that calls the render function.
- **All visual highlighting goes through render functions.** No event handler calls `classList.add` or `classList.remove` on a cell. The three visual layers (single-cell, range, formula-range) each have their own render function. They are the only code that touches their respective CSS classes.
- **Derived state is never stored.** If a value can be computed from the source-of-truth state, it is computed — never cached in a separate flag that can fall out of sync. `rangeMode` is the canonical example of what not to do.
- **Shared logic lives in one place.** The selection bounding box (`c1, r1, c2, r2`) is computed by one helper. Copy and cut don't each have their own version. Range deletion and range cut don't each have their own version.
- **State is grouped by concern.** Related variables are an object, not six parallel scalars. This forces a named boundary around each concept and makes partial updates visibly wrong.

---

## Engine interface (consumed by ui.js)

```js
engine.getData()               // → { [cellId]: rawString }  (formula or literal)
engine.getCache()              // → { [cellId]: displayString } (computed value)
engine.setCell(id, value)      // sets cell, triggers recalc + subscriber callbacks
engine.pushHistory()           // snapshot current state for undo
engine.undo()                  // restore previous snapshot; returns truthy if successful
engine.subscribe(fn)           // fn called as fn([[id, displayValue], ...]) on any update
```

---

## DOM contract

The following elements must exist in the HTML before `initUI` is called:

| ID | Element | Role |
|---|---|---|
| `g` | `div` | Grid root; cells are rendered here as children |
| `gc` | `div` | Scrollable container wrapping `g` |
| `fb` | `input` | Formula bar — shows/edits raw value of active cell |
| `aci` | `span` | Active cell indicator — displays cell ID like "A1" |
| `ed` | `textarea` or `input` | Inline editor — overlaid on top of the active cell |
| `info-modal` | `div` | Help/info modal, toggled via `hidden` attribute |
| `info-btn` | `button` | Opens the info modal |
| `info-close` | `button` | Closes the info modal |
| `sv` | `button` | Save button — `initUI` clicks this on Ctrl+S |
| `file-title` | `[contenteditable]` | Editable file name in the toolbar |

`initUI` creates two overlay divs programmatically and appends them to `g`:
- `#rb` — border overlay for regular range selection
- `#frb` — border overlay for formula range selection

---

## Coordinate system

- **Columns**: 0-indexed, `0`–`COLS-1` (currently 26, i.e. A–Z)
- **Rows**: 1-indexed, `1`–`ROWS` (currently 50)
- **Cell ID**: opaque string produced by `mid(col, row)` from `parser.js` — looks like `"A1"`, `"B3"`, etc.
- **Parsing**: `parseId(id)` → `[col, row]`; `colName(col)` → `"A"`, `"B"`, etc.
- **Default sizes**: columns 109px wide, rows 24px tall; minimums 30px / 16px

---

## Grid DOM structure

`buildGrid()` produces this layout inside `g` (a CSS grid):

```
[corner]  [col-header A] [col-header B] ... [col-header Z]
[row-hdr 1] [cell A1] [cell B1] ... [cell Z1]
[row-hdr 2] [cell A2] ...
...
```

- Column header: `div.cell.ch.col[data-col=N]` containing the column letter and a `div.col-resize-handle[data-resize-col=N]`
- Row header: `div.cell.ch.row[data-row=N]` containing the row number and a `div.row-resize-handle[data-resize-row=N]`
- Cell: `div.cell.cv#x{cellId}` — text content is the display value
- `grid.style.gridTemplateColumns` / `gridTemplateRows` must be updated whenever column/row sizes change

---

## State architecture

Group state by concern. Each group is a single object or a small set of closely related primitives. No group leaks into another group's logic.

```js
// Selection: the one true source of where the user is
let sel = {
  anchor: { col: 0, row: 1 },
  cursor: { col: 0, row: 1 },   // equals anchor when no range is active
};
// Derived (never stored): isRange = anchor.col !== cursor.col || anchor.row !== cursor.row

// Edit mode
let editing = false;

// Formula range insertion (null when inactive)
let formulaRange = null;
// When active:
// {
//   input: HTMLElement,     // the editor or formula bar
//   insertPos: number,      // cursor position in the input where ref goes
//   prevRefLen: number,     // length of the ref currently inserted (for replacement)
//   anchor: { col, row },   // where the drag started
// }

// Column/row resize (null when inactive)
let resize = null;
// When active:
// {
//   type: 'col' | 'row',
//   index: number,
//   startPos: number,    // clientX or clientY at drag start
//   origSize: number,    // size at drag start
// }

// Mouse drag for range selection
let dragging = false;
```

---

## Selection API — the single choke point

Every interaction that changes selection must call `setSelection`. Nothing else may mutate `sel` or call `renderSelection`.

```js
function setSelection(anchor, cursor = anchor) {
  // clamp both to grid bounds
  // update sel.anchor and sel.cursor
  // call renderSelection()       ← the only caller
  // update aci text
  // update formula bar value
  // scroll cursor cell into view
}
```

`setSelection` is called from: click, shift+click, drag end, arrow keys, shift+arrow, Tab, Enter (navigation), Ctrl+A, Escape (collapse). That's the complete list. If a new interaction is added and it changes selection, it calls `setSelection` — no exceptions.

Helper used everywhere selection bounds are needed:

```js
function getSelectionBounds() {
  return {
    c1: Math.min(sel.anchor.col, sel.cursor.col),
    c2: Math.max(sel.anchor.col, sel.cursor.col),
    r1: Math.min(sel.anchor.row, sel.cursor.row),
    r2: Math.max(sel.anchor.row, sel.cursor.row),
  };
}
```

This is the only place the bounding box is computed. Copy, cut, range delete, and range paste all call it — they do not each reimplement `Math.min(anchorCol, endCol)`.

---

## Visual highlighting — three independent layers

Each layer owns exactly one CSS class and (for layers 2 and 3) one overlay div. No layer touches another layer's class or overlay. The three layers can be simultaneously active without conflict.

### Layer 1 — active cell (`sel`)

Managed entirely inside `renderSelection`. No other code adds or removes `sel`.

- Add `sel` to the anchor cell.
- Remove it from the previous anchor cell.
- This is always present — including after Ctrl+A (A1 gets `sel`).

### Layer 2 — range fill (`range` + `#rb`)

Managed entirely inside `renderSelection`. No other code adds or removes `range` or repositions `#rb`.

- Maintain a `Set<cellId>` of cells currently holding `range`.
- On each render: iterate the set to remove the class, clear the set, then add `range` to the new bounding box and repopulate the set. This is O(prev range size + new range size), not O(grid).
- Position `#rb` using `offsetLeft`/`offsetTop` of the corner cells. Show when `isRange`, hide otherwise.
- When `isRange` is false, the set is empty and `#rb` is hidden — there is no separate `clearRange` path that forgets to do one of these things.

### Layer 3 — formula range (`formula-ref` + `#frb`)

Managed entirely inside `renderFormulaRange` / `clearFormulaRange`. Completely independent of layers 1 and 2.

- Same `Set<cellId>` pattern for efficient clearing.
- `clearFormulaRange` iterates the set and hides `#frb`. Called when formula range mode ends (mouseup) or is interrupted.
- `renderFormulaRange(anchor, cursor)` replaces the current formula highlight with the new range.

### Rule

**No event handler calls `classList.add`/`classList.remove` on a cell.** If you find yourself writing `el.classList.add('range')` in a mouse handler, that logic belongs in a render function instead.

---

## Behavior spec

### Cell navigation

| Input | Behavior |
|---|---|
| Click cell | `setSelection(cell, cell)` |
| Shift+click cell | `setSelection(sel.anchor, cell)` |
| Click+drag | `setSelection(startCell, currentCell)` on each mousemove |
| Arrow keys | `setSelection(neighbor, neighbor)` — collapses range |
| Shift+Arrow | `setSelection(sel.anchor, clamp(sel.cursor + delta))` |
| Tab | `setSelection(right, right)` |
| Shift+Tab | `setSelection(left, left)` |
| Enter (not editing) | `setSelection(below, below)` |
| Escape | `setSelection(sel.anchor, sel.anchor)` — collapses to anchor |
| Ctrl+A | `setSelection({col:0,row:1}, {col:COLS-1,row:ROWS})` |

All navigation clamps to grid bounds inside `setSelection`.

### Edit mode

Entry (all operate on `sel.anchor`):
- Double-click a cell
- Enter, F2, or any printable non-modifier character while not editing (the character becomes the initial editor content)

| Input | Behavior |
|---|---|
| Enter | Commit; `setSelection(below, below)` |
| Tab | Commit; `setSelection(right, right)` |
| Escape | Cancel; restore original value |

Commit: call `engine.setCell`, hide `#ed`, clear `editing` flag.  
Cancel: hide `#ed`, clear `editing` flag. Do not call `engine.setCell`.

`#ed` positioning: translate it over the active cell using `getBoundingClientRect()` deltas, adding `gc.scrollLeft`/`scrollTop` to account for container scroll.

### Formula bar / editor sync

The formula bar and inline editor are always in sync — they show the same raw value. The sync is one-directional per interaction:

- `setSelection` writes `getData()[anchor]` to `fb.value`. This is the only place `fb.value` is set from selection changes.
- `#ed` input event → write to `fb.value`
- `fb` input event → write to `#ed.value` if editing; also call `engine.setCell` live
- History: call `engine.pushHistory()` once before the first `setCell` in an edit session, not on every focus event.

### Formula range insertion

Activated when a formula input (`#ed` or `#fb`) is focused, its value starts with `=`, and the character immediately before the cursor is an operator: `( , = + - * / ^ % & < >`.

State transitions:
- **Mousedown on cell**: set `formulaRange = { input, insertPos, prevRefLen: 0, anchor: cell }`, call `insertFormulaRef(cell)`, call `renderFormulaRange(cell, cell)`. Return early — do not navigate.
- **Mousemove**: call `insertFormulaRef(rangeRef(formulaRange.anchor, currentCell))`, call `renderFormulaRange(formulaRange.anchor, currentCell)`.
- **Mouseup**: call `clearFormulaRange()`, restore focus to `formulaRange.input`, set cursor position; set `formulaRange = null`.

`insertFormulaRef(ref)` splices `ref` into the input value at `insertPos`, replacing the previous `prevRefLen` characters. Updates `prevRefLen = ref.length`.

### Clipboard

The selection bounding box always comes from `getSelectionBounds()`.

| Input | Behavior |
|---|---|
| Ctrl+C | If single cell: copy `getData()[anchor]`. If range: copy TSV via `serializeRange`. |
| Ctrl+X | Same copy logic, then `engine.pushHistory()` and clear all cells in bounds. |
| Paste | Parse clipboard text. If single value (no `\t`, no newline): `engine.setCell(anchor, value)`. If multi: spread from anchor, clamped to grid. Strip `\r` before splitting on `\n`. Ignored when editing, or `#fb`/`#file-title` is focused. |

`serializeRange` uses `engine.getCache()` for display values. It is one function, shared by copy and cut.

### Delete

| Input | Behavior |
|---|---|
| Backspace / Delete (not editing) | `engine.pushHistory()`; clear all cells in `getSelectionBounds()`. Single cell and range use the same code path. |

### Undo

| Input | Behavior |
|---|---|
| Ctrl+Z | `engine.undo()`; update `fb.value` from current anchor. |

### Save

| Input | Behavior |
|---|---|
| Ctrl+S (anywhere except `#file-title`) | `document.getElementById('sv').click()` |

### Column / row resize

Resize state is `null` when idle, a `resize` object when active. All resize logic gates on this object — no separate boolean flags.

- Mousedown on `.col-resize-handle` or `.row-resize-handle`: populate `resize`, add `col-resizing`/`row-resizing` to `document.body`.
- Mousemove: if `resize !== null`, update the appropriate size array, call `updateGridTemplate()`.
- Mouseup: if `resize !== null`, remove body classes, set `resize = null`.

### Info modal

| Input | Behavior |
|---|---|
| Ctrl+I | Toggle `infoModal.hidden` |
| Click `#info-btn` | `infoModal.hidden = false` |
| Click `#info-close` or backdrop | `infoModal.hidden = true`; focus `gc` |
| Escape (modal open) | `infoModal.hidden = true`; focus `gc` |
| Any other key (modal open) | Absorb — return before reaching grid handlers |

### File title

| Input | Behavior |
|---|---|
| Enter or Escape | Focus `gc` |
| Ctrl+S | Trigger save |

---

## Bugs that must not survive the rewrite

These are consequences of the design problems above, listed here so they are explicitly not inherited:

1. **Redundant selection coordinates** — `sc`/`sr` duplicated `endCol`/`endRow`. The rewrite has one cursor.
2. **`rangeMode` as stored flag** — falls out of sync across seven mutation sites. Derive it.
3. **`sel` missing after Ctrl+A** — `selectAll` never added `sel` to A1. Because `renderSelection` is the sole writer of `sel`, this cannot happen.
4. **O(grid) class clear on mousemove** — use tracked Sets; clearing is O(highlighted count).
5. **History pushed on `fb` focus** — push history once before the first `setCell`, not on every focus.
6. **Windows line endings in paste** — split on `/\r?\n/`.
7. **`formulaActiveInput` null crash on mouseup** — guard; or structure the state so mouseup only runs this path when `formulaRange !== null`.
8. **Copy and cut reimplementing bounding-box logic independently** — both call `getSelectionBounds()`.
