# TouchGal Local Manager Agent Knowledge

Short project facts for future agents working in this repository.

## Project Snapshot

- Electron 41
- electron-vite 5
- Vite 7
- React 19
- Zustand 5
- Tailwind CSS 4
- better-sqlite3
- package manager: pnpm

## Runtime Boundaries

- Main process owns upstream API access and SQLite.
- Renderer must go through `window.api`.
- Preload is bundled as CommonJS `.cjs`.

## Advanced Filter Rule

- Homepage tag filtering is strict local filtering.
- Do not rely on `/search` for homepage tag correctness.

## Useful Pointers

- Main relay: `src/main/index.ts`
- SQLite bootstrap: `src/main/db.ts`
- Renderer state: `src/renderer/src/store/useTouchGalStore.ts`
- Docs index: `docs/README.md`

## Recovery Workflows

- `.agents/workflows/fix-electron-env.md`
- `.agents/workflows/fix-electron-win.md`
