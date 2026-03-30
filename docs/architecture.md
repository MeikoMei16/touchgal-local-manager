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
- upstream session token persistence and normalization
- Electron window lifecycle
- SQLite access
- filesystem access
- download queue state

Rules:

- Renderer must not call TouchGal upstream APIs directly.
- Normalization of inconsistent upstream payloads belongs here.
- Upstream auth cookie/header construction belongs here.

Session handling notes:

- the main process stores the TouchGal token under Electron `userData`
- token input is normalized before persistence so legacy `Bearer ...`, full cookie strings, and whitespace-polluted values do not poison request headers
- upstream browse/search requests only attach a `Cookie` header when there is a valid normalized auth cookie to send

### Preload

Owns:

- the safe IPC bridge exposed via `contextBridge`

Current output:

- bundled as CommonJS `.cjs` by `electron.vite.config.ts`

### Renderer

Owns:

- application UI
- auth UI state
- homepage query state and result state
- advanced-filter orchestration
- detail overlay lifecycle
- detail header composition and rating histogram presentation

Homepage state currently lives in [`src/renderer/src/store/useTouchGalStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/useTouchGalStore.ts).

Key frontend state split:

- persisted homepage query: `lastHomeQuery`
- persisted homepage page index: `currentPage`
- advanced draft state: `advancedFilterDraft`
- advanced datasets and progress: `advancedDatasetsByDomain`, `advancedBuildProgress`
- current result view: `resources`, `totalResources`, `currentPage`, `homeMode`
- auth modal state: captcha payloads, login errors, and session-expired UI state
- detail view state: `selectedResource`, `patchComments`, `patchRatings`, `isDetailLoading`

Renderer persistence notes:

- homepage UI state is persisted through Zustand in renderer `localStorage`
- auth UI state is persisted separately from the encrypted token managed by the main process
- persisted homepage state is intentionally narrow: `lastHomeQuery` and `currentPage`
- hydration is explicitly gated before homepage mount effects issue a normal-mode fetch

Important note:

- sorting for the homepage is store-owned, not component-local
- tag constraints are represented by `advancedFilterDraft.selectedTags` as the single source of truth
- normal homepage refresh should restore sort key, sort order, upstream filters, and current page from persisted state
- upstream homepage controls (`nsfwMode`, `selectedPlatform`, `minRatingCount`) are rendered directly in the homepage top bar, left of `高级筛选`

## Data Flow

Normal homepage browsing:

1. Renderer hydrates `lastHomeQuery` and `currentPage` from persisted UI storage.
2. Homepage fetch effects wait until hydration is complete.
3. Renderer derives a normalized homepage query from store state.
4. Renderer calls `TouchGalClient.fetchGalgameResources()`.
5. Preload forwards to `tg-fetch-resources`.
6. Main process relays to upstream TouchGal API and normalizes the response.
7. Renderer store updates `resources`, `totalResources`, and pagination state.

Normal homepage refresh behavior:

1. Refresh recreates the renderer process.
2. Zustand rehydrates persisted `lastHomeQuery` and `currentPage`.
3. Homepage mount effects resume with the hydrated values instead of falling back to page `1` and default sort.

Advanced homepage browsing:

1. Renderer keeps the active homepage query in `lastHomeQuery`.
2. Entering advanced mode builds or reuses a domain-scoped local candidate dataset.
3. Stage 2 and Stage 3 filtering are applied locally against that dataset.
4. Local sorting and pagination update the same result view state used by normal mode.

Homepage top bar behavior:

1. Sort controls remain on the left side of the homepage toolbar.
2. Upstream browse controls live on the right side, immediately to the left of `高级筛选`.
3. Those controls still write into `lastHomeQuery`, so they participate in the same persistence and refresh-restore path as all other homepage query fields.

Exiting advanced search:

1. Renderer clears advanced constraints and advanced-mode UI state.
2. Homepage returns to `normal` mode.
3. The reset query preserves the current top-level sort field and sort order.
4. A fresh normal-mode fetch is triggered from the reset homepage query.

Login and captcha flow:

1. Renderer requests either a legacy captcha image or a challenge payload through the main-process relay.
2. Captcha verification failures fetch a fresh captcha and surface a retry error.
3. Credential failures after a successful captcha solve clear the captcha UI and return the user to the login form with an error, rather than immediately chaining into another captcha prompt.
4. Successful login clears captcha UI state while token/session handling remains in the main process.

Detail loading:

1. Renderer selects a card.
2. Store opens an immediate detail shell from the selected homepage card when available.
3. Store fetches the normalized detail payload first.
4. Store derives the final patch id from the resolved detail payload, then fetches comments and ratings with that id.
5. Late responses from stale detail opens are ignored so an older click cannot overwrite a newer selection.
6. Detail overlay renders normalized merged data.

Detail header layout:

- the detail header uses a two-column desktop layout inside the right panel
- primary game metadata, tags, and actions stay in the left header column
- the compact `RatingHistogram` widget occupies the spare right-side header space on desktop
- company/date and aggregate counters render in a dedicated footer strip under the header content

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
- Homepage refresh persistence for query, sort, and page
- Login and captcha relay
- Main-process token normalization and safer upstream cookie/header assembly
- Detail overlay with introduction, comments, and ratings
- Guarded detail loading that resolves comments/ratings from the final detail id
- Modular detail rating histogram component in the header
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
