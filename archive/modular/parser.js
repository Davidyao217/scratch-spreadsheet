// parser.js — tokenizer + Shunting-Yard parser + dependency extraction.
// Pure functions. No state. No DOM.

export const colName = i => String.fromCharCode(65 + i);
export const parseId = s => [s.charCodeAt(0) - 65, +s.slice(1)];
export const mid = (c, r) => colName(c) + r;

const PREC = { u: 4, '^': 3, '*': 2, '/': 2, '+': 1, '-': 1 };
const RIGHT = { '^': 1, u: 1 };

export function tokenize(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if ((c >= '0' && c <= '9') || c === '.') {
      let j = i + 1;
      while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) j++;
      t.push({ k: 'n', v: +s.slice(i, j) });
      i = j;
    } else if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) {
      let j = i + 1;
      while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j++;
      const w = s.slice(i, j).toUpperCase();
      i = j;
      if (/^[A-Z]+\d+$/.test(w)) {
        if (s[i] === ':') {
          let k = i + 1;
          while (k < s.length && /[A-Za-z0-9]/.test(s[k])) k++;
          t.push({ k: 'r', a: w, b: s.slice(i + 1, k).toUpperCase() });
          i = k;
        } else t.push({ k: 'c', v: w });
      } else t.push({ k: 'f', v: w });
    } else {
      const p = t[t.length - 1];
      if (c === '-' && (!p || (p.k === 'o' && p.v !== ')'))) {
        t.push({ k: 'o', v: 'u' });
      } else if ('+-*/^(),'.indexOf(c) >= 0) {
        t.push({ k: 'o', v: c });
      } else throw new Error('bad char');
      i++;
    }
  }
  return t;
}

// Shunting-yard. Tracks function arity by counting commas + values within fn parens.
export function parse(toks) {
  const out = [], ops = [], arity = [];
  const bumpArity = () => {
    if (arity.length && arity[arity.length - 1] === 0) arity[arity.length - 1] = 1;
  };
  for (const t of toks) {
    if (t.k === 'n' || t.k === 'c' || t.k === 'r') {
      out.push(t);
      bumpArity();
    } else if (t.k === 'f') {
      ops.push(t);
    } else if (t.v === '(') {
      const fn = ops.length && ops[ops.length - 1].k === 'f';
      ops.push(t);
      if (fn) arity.push(0);
    } else if (t.v === ')') {
      while (ops.length && ops[ops.length - 1].v !== '(') out.push(ops.pop());
      if (!ops.length) throw new Error('mismatched paren');
      ops.pop();
      if (ops.length && ops[ops.length - 1].k === 'f') {
        const f = ops.pop();
        out.push({ k: 'f', v: f.v, a: arity.pop() });
      }
      bumpArity(); // closing a subexpression produced a value for the surrounding fn
    } else if (t.v === ',') {
      while (ops.length && ops[ops.length - 1].v !== '(') out.push(ops.pop());
      if (!arity.length) throw new Error('comma outside fn');
      arity[arity.length - 1]++;
    } else { // operator
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.v === '(' || top.k === 'f') break;
        const tp = PREC[top.v] || 0, cp = PREC[t.v] || 0;
        if (tp > cp || (tp === cp && !RIGHT[t.v])) out.push(ops.pop());
        else break;
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    const x = ops.pop();
    if (x.v === '(') throw new Error('mismatched paren');
    out.push(x);
  }
  return out;
}

// Walks an RPN expression and returns the set of cell IDs it depends on.
export function findDeps(rpn) {
  const d = new Set();
  for (const t of rpn) {
    if (t.k === 'c') d.add(t.v);
    else if (t.k === 'r') {
      const [c1, r1] = parseId(t.a), [c2, r2] = parseId(t.b);
      for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
          d.add(mid(c, r));
    }
  }
  return d;
}
