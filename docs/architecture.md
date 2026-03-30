# Architecture

TouchGal Local Manager is an Electron desktop app that proxies TouchGal upstream APIs through the main process and layers local stateful UX on top of them.

## Stack

- Electron 41
- electron-vite 5
- Vite 7
- React 19
- Zustand 5
- Tailwind CSS 4
- better-sqlite3

## Runtime Layout

```text
src/main/
  index.ts        IPC hub, upstream API relay, response normalization
  db.ts           SQLite schema bootstrap and cache helpers
  downloader.ts   Early-stage download queue manager
  utils.ts        Filesystem helpers

src/preload/
  index.ts        contextBridge surface exposed as window.api

src/renderer/src/
  components/     UI
  data/           TouchGalClient window.api wrapper
  store/          Zustand state and advanced-filter pipeline
  schemas/        Zod schemas
  types/          Shared renderer-side types
```

## Process Boundaries

### Main Process

Owns:

- upstream HTTP requests
- Electron window lifecycle
- SQLite access
- filesystem access
- download queue state

Rules:

- Renderer must not call TouchGal upstream APIs directly.
- Normalization of inconsistent upstream payloads belongs here.

### Preload

Owns:

- the safe IPC bridge exposed via `contextBridge`

Current output:

- bundled as CommonJS `.cjs` by `electron.vite.config.ts`

### Renderer

Owns:

- application UI
- homepage query state and result state
- advanced-filter orchestration
- detail overlay lifecycle

Homepage state currently lives in [`src/renderer/src/store/useTouchGalStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/useTouchGalStore.ts).

Key frontend state split:

- persisted homepage query: `lastHomeQuery`
- advanced draft state: `advancedFilterDraft`
- advanced datasets and progress: `advancedDatasetsByDomain`, `advancedBuildProgress`
- current result view: `resources`, `totalResources`, `currentPage`, `homeMode`

Important note:

- sorting for the homepage is store-owned, not component-local
- tag constraints are represented by `advancedFilterDraft.selectedTags` as the single source of truth

## Data Flow

Normal homepage browsing:

1. Renderer derives a normalized homepage query from store state.
2. Renderer calls `TouchGalClient.fetchGalgameResources()`.
3. Preload forwards to `tg-fetch-resources`.
4. Main process relays to upstream TouchGal API and normalizes the response.
5. Renderer store updates `resources`, `totalResources`, and pagination state.

Advanced homepage browsing:

1. Renderer keeps the active homepage query in `lastHomeQuery`.
2. Entering advanced mode builds or reuses a domain-scoped local candidate dataset.
3. Stage 2 and Stage 3 filtering are applied locally against that dataset.
4. Local sorting and pagination update the same result view state used by normal mode.

Exiting advanced search:

1. Renderer clears advanced constraints and advanced-mode UI state.
2. Homepage returns to `normal` mode.
3. A fresh normal-mode fetch is triggered from the reset homepage query.

Detail loading:

1. Renderer selects a card.
2. Store fetches detail, introduction, comments, and ratings.
3. Detail overlay renders normalized merged data.

## Local Persistence

SQLite is initialized in [`src/main/db.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/main/db.ts).

Current schema areas include:

- `games`
- `games_fts`
- `companies`
- `tags`
- `game_tags`
- `external_ids`
- `local_paths`
- `media_cache`
- `download_tasks`
- `play_sessions`
- `personal_metadata`
- `collections`

Status note:

- The schema is broader than currently shipped UI features.
- Some tables support planned local-first capabilities that are only partially wired today.

## Current Feature Status

### Implemented or Active

- Homepage resource browsing
- Login and captcha relay
- Detail overlay with introduction, comments, and ratings
- Advanced filtering with local multi-stage pipeline
- Basic SQLite bootstrap
- Basic download queue persistence and link parsing scaffold

### Partial / In Progress

- Local metadata cache usage is still limited
- Downloader is scaffolded, not full end-to-end
- Offline-first search is not yet the main browse path

## Important Constraints

- Upstream API relay lives in the main process.
- Advanced tag filtering must not depend on `/search`.
- Stage 1 advanced-filter fields should be handled upstream, not re-applied locally.
- Renderer-side advanced filtering is domain-scoped: `sfw`, `nsfw`, and `all`.
