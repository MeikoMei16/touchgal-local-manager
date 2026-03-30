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
- local interaction state
- advanced-filter orchestration
- detail overlay lifecycle

## Data Flow

Normal homepage browsing:

1. Renderer calls `TouchGalClient.fetchGalgameResources()`.
2. Preload forwards to `tg-fetch-resources`.
3. Main process relays to upstream TouchGal API and normalizes the response.
4. Renderer store updates `resources`, `totalResources`, and pagination state.

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
