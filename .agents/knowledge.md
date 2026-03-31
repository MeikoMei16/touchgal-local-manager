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

## Detail Page Notes

- Detail loading is store-driven from `uiStore` detail actions.
- Comments and ratings must be fetched from the resolved detail id, not only the homepage card id.
- Ignore stale detail responses when users switch cards quickly.
- `RatingHistogram.tsx` is the dedicated detail rating chart component.
- `DetailOverlay.tsx` is now a composition shell; detail tab bodies live under `src/renderer/src/components/detail/`.

## Advanced Filter Rule

- Homepage tag filtering is strict local filtering.
- Do not rely on `/search` for homepage tag correctness.
- Homepage upstream controls (`nsfwMode`, `selectedPlatform`, `minRatingCount`) live in the top bar, not inside the advanced panel.

## Useful Pointers

- Main relay: `src/main/index.ts`
- SQLite bootstrap: `src/main/db.ts`
- Auth state: `src/renderer/src/store/authStore.ts`
- UI state assembly: `src/renderer/src/store/uiStore.ts`
- UI action modules: `src/renderer/src/store/uiActions/`
- Compatibility bridge only: `src/renderer/src/store/useTouchGalStore.ts`
- Docs index: `docs/README.md`

## Recovery Workflows

- `.agents/workflows/fix-electron-env.md`
- `.agents/workflows/fix-electron-win.md`
