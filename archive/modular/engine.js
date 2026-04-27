// engine.js — state, dependency graph, evaluator, reactive recompute.
// No DOM. Notifies the UI through an onUpdate callback.

import { tokenize, parse, findDeps, parseId, mid } from './parser.js';

const FN = {
  SUM: a => a.reduce((s, x) => s + (+x || 0), 0),
  AVERAGE: a => {
    const n = a.filter(x => x !== '' && !isNaN(+x));
    return n.length ? FN.SUM(n) / n.length : 0;
  },
  MIN: a => {
    const n = a.map(Number).filter(x => !isNaN(x));
    return n.length ? Math.min(...n) : 0;
  },
  MAX: a => {
    const n = a.map(Number).filter(x => !isNaN(x));
    return n.length ? Math.max(...n) : 0;
  },
  COUNT: a => a.filter(x => x !== '' && !isNaN(+x)).length
};

// === State ===
export const data = {};   // raw user input per cell ID
export const cache = {};  // computed displayable value per cell ID
const comp = {};          // compiled formulas: { rpn, deps } | { err, deps } | null
const fwd = {};           // id -> Set of cells this cell reads
const rev = {};           // id -> Set of cells that read this cell
let onUpdate = () => {};

export function setOnUpdate(fn) { onUpdate = fn; }

// === DAG edge maintenance ===
function setDeps(id, nd) {
  const old = fwd[id];
  if (old) for (const d of old) rev[d] && rev[d].delete(id);
  fwd[id] = nd;
  for (const d of nd) (rev[d] = rev[d] || new Set()).add(id);
}

function compile(id) {
  const raw = (data[id] || '').toString();
  let p = null;
  if (raw[0] === '=') {
    try {
      const rpn = parse(tokenize(raw.slice(1)));
      p = { rpn, deps: findDeps(rpn) };
    } catch (e) {
      p = { err: '#ERR!', deps: new Set() };
    }
  }
  comp[id] = p;
  setDeps(id, p ? p.deps : new Set());
}

// === Evaluator ===
function evalRPN(rpn) {
  const st = [];
  for (const t of rpn) {
    if (t.k === 'n') st.push(t.v);
    else if (t.k === 'c') {
      const v = cache[t.v];
      st.push(v === undefined || v === '' ? 0 : v);
    } else if (t.k === 'r') {
      const arr = [], [c1, r1] = parseId(t.a), [c2, r2] = parseId(t.b);
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          const v = cache[mid(c, r)];
          arr.push(v === undefined ? '' : v);
        }
      st.push(arr);
    } else if (t.k === 'f') {
      const args = [];
      for (let i = 0; i < t.a; i++) args.unshift(st.pop());
      const flat = [];
      for (const a of args) Array.isArray(a) ? flat.push(...a) : flat.push(a);
      if (!FN[t.v]) return '#NAME?';
      st.push(FN[t.v](flat));
    } else {
      if (t.v === 'u') {
        const a = +st.pop();
        st.push(isNaN(a) ? NaN : -a);
      } else {
        const b = +st.pop(), a = +st.pop();
        let r;
        switch (t.v) {
          case '+': r = a + b; break;
          case '-': r = a - b; break;
          case '*': r = a * b; break;
          case '/': r = b === 0 ? NaN : a / b; break;
          case '^': r = Math.pow(a, b); break;
        }
        st.push(r);
      }
    }
  }
  const r = st[0];
  if (typeof r === 'string') return r;
  if (r === undefined || r === null) return '';
  return Number.isFinite(r) ? r : '#ERR!';
}

function evalCell(id) {
  const c = comp[id];
  if (!c) {
    const raw = (data[id] || '').toString().trim();
    if (raw === '') return '';
    const n = +raw;
    return isNaN(n) ? raw : n;
  }
  if (c.err) return c.err;
  return evalRPN(c.rpn);
}

// === Reactive recompute ===
// 1. Walk reverse-deps from seeds to find affected set.
// 2. Kahn topological sort within that subgraph.
// 3. Evaluate in order. Cells left over are part of a cycle.
function recompute(seeds) {
  const aff = new Set(), stk = [...seeds];
  while (stk.length) {
    const x = stk.pop();
    if (aff.has(x)) continue;
    aff.add(x);
    if (rev[x]) for (const d of rev[x]) stk.push(d);
  }
  const indeg = {}, adj = {};
  for (const x of aff) { indeg[x] = 0; adj[x] = []; }
  for (const x of aff) if (fwd[x]) for (const d of fwd[x]) if (aff.has(d)) {
    adj[d].push(x); indeg[x]++;
  }
  const q = [], order = [];
  for (const x of aff) if (!indeg[x]) q.push(x);
  while (q.length) {
    const x = q.shift(); order.push(x);
    for (const y of adj[x]) if (--indeg[y] === 0) q.push(y);
  }
  const sorted = new Set(order);
  for (const x of order) cache[x] = evalCell(x);
  for (const x of aff) if (!sorted.has(x)) cache[x] = '#CIRC!';

  const updates = new Map();
  for (const x of aff) updates.set(x, cache[x]);
  onUpdate(updates);
}

// === Public API ===
export function setCell(id, raw) {
  data[id] = raw;
  compile(id);
  recompute([id]);
}

export function clearAll() {
  const keys = Object.keys(data);
  for (const k of keys) data[k] = '';
  for (const k of keys) compile(k);
  recompute(keys);
}

export function init(initial) {
  for (const k in initial) data[k] = initial[k];
  for (const k in data) compile(k);
  recompute(Object.keys(data));
}
