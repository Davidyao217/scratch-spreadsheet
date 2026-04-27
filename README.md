## Sheet Scratchpad

**What:** Browser-based spreadsheet for quick arithmetic scratchwork. The analog is `text.new` — you type a short URL and you're immediately editing. No auth, no onboarding, no server.

**Core constraint:** Time-to-first-keystroke. The app must be usable within the same frame as DNS resolution + a single HTML payload. Zero render-blocking dependencies.

**Scope:**
- Grid sized for ~20 active cells (not 10k)
- Formula engine: cell refs (`A1`), ranges (`A1:B5`), arithmetic, `SUM`/`AVERAGE`/`MIN`/`MAX`/`COUNT`
- Circular reference detection
- CSV export (computed values, auto-bounded to used range)
- Formula bar + keyboard nav (Enter/Tab/Escape)

**Non-goals:** Persistence, collaboration, formatting, import, undo history, mobile optimization.

**Command for dist build:** 
```
npx vite build
```

**command for testing**
```
npm run test
npm run test:e2e
```
