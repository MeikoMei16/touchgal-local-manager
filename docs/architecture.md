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
  store/          Zustand stores, type boundaries, compatibility bridge, action modules
  features/       query logic, advanced-filter helpers, detail normalization
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
- logout is finalized in the main process by clearing the in-memory token and removing persisted token files through `tg-logout`

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
- renderer-side feature module composition

Renderer state implementation is now split:

- [`src/renderer/src/store/authStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/authStore.ts): auth UI state
- [`src/renderer/src/store/uiStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/uiStore.ts): UI store assembly and persistence
- [`src/renderer/src/store/uiActions/`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/uiActions): browse, detail, and advanced action modules
- [`src/renderer/src/store/useTouchGalStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/useTouchGalStore.ts): compatibility bridge only

Key frontend state split:

- persisted homepage query: `lastHomeQuery`
- persisted homepage page index: `currentPage`
- advanced draft state: `advancedFilterDraft`
- advanced datasets and progress: `advancedDatasetsByDomain`, `advancedBuildProgress`
- current result view: `resources`, `totalResources`, `currentPage`, `homeMode`
- auth modal state: captcha payloads, login errors, and session-expired UI state
- detail view state: `selectedResource`, `patchComments`, `patchRatings`, `isDetailLoading`

Renderer code split:

- homepage query rules and controller: [`src/renderer/src/features/home/homeQuery.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/features/home/homeQuery.ts), [`src/renderer/src/features/home/useHomeQueryController.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/features/home/useHomeQueryController.ts)
- advanced-filter pure helpers: [`src/renderer/src/features/home/advancedDataset.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/features/home/advancedDataset.ts)
- detail normalization helpers: [`src/renderer/src/features/detail/detailResource.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/features/detail/detailResource.ts)
- detail overlay subcomponents: [`src/renderer/src/components/detail/`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/components/detail)

Renderer persistence notes:

- homepage UI state is persisted through Zustand in renderer `localStorage`
- auth UI state is persisted separately from the encrypted token managed by the main process
- renderer logout must clear both layers: renderer auth state and the main-process token
- persisted homepage state is intentionally narrow: `lastHomeQuery` and `currentPage`
- hydration is explicitly gated before homepage mount effects issue a normal-mode fetch
- `uiStore.ts` owns the persistence configuration, but action implementations are delegated to `uiActions/*`

Important note:

- sorting for the homepage is store-owned, not component-local
- `sortField === 'rating'` is treated as an advanced-mode trigger because upstream rating pagination is unstable
- tag constraints are represented by `advancedFilterDraft.selectedTags` as the single source of truth
- normal homepage refresh should restore sort key, sort order, upstream filters, and current page from persisted state
- upstream homepage controls (`nsfwMode`, `selectedPlatform`, `minRatingCount`) are rendered directly in the homepage top bar, left of `高级筛选`
- `useTouchGalStore.ts` should be treated as a compatibility layer, not as the place to add new state logic

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
2. Queries that require local correctness — including `sortField === 'rating'` — enter advanced mode instead of trusting upstream pagination.
3. Entering advanced mode builds or reuses a domain-scoped local candidate dataset using only upstream coarse filters.
4. Stage 2 and Stage 3 filtering are applied locally against that dataset.
5. Local sorting and pagination update the same result view state used by normal mode.

Homepage top bar behavior:

1. Sort controls remain on the left side of the homepage toolbar.
2. Upstream browse controls live on the right side, immediately to the left of `高级筛选`.
3. Those controls still write into `lastHomeQuery`, so they participate in the same persistence and refresh-restore path as all other homepage query fields.
4. Choosing rating sort routes the homepage through the same local advanced pipeline used by advanced filtering; there is no separate rating-only mode.

Exiting advanced search:

1. Renderer clears advanced constraints and advanced-mode UI state.
2. Homepage returns to `normal` mode.
3. The reset query currently preserves the current top-level sort field and sort order.
4. If the preserved query still requires local correctness — notably `sortField === 'rating'` — the controller immediately re-enters the advanced local-catalog path instead of staying on normal API pagination.
5. Otherwise, a fresh normal-mode fetch is triggered from the reset homepage query.

Login and captcha flow:

1. Renderer requests either a legacy captcha image or a challenge payload through the main-process relay.
2. Captcha verification failures fetch a fresh captcha and surface a retry error.
3. Credential failures after a successful captcha solve clear the captcha UI and return the user to the login form with an error, rather than immediately chaining into another captcha prompt.
4. Successful login clears captcha UI state while token/session handling remains in the main process.
5. Logout clears the persisted TouchGal token in the main process in addition to resetting renderer auth state.

Profile loading:

1. Renderer resolves the self identity through `getUserStatusSelf()`.
2. If a usable `uid` or `id` is present, renderer fetches the full profile with `getUserStatus(uid)`.
3. If self-status resolves without a usable id, profile loading must still settle back to a non-loading state instead of hanging the screen.

Detail loading:

1. Renderer selects a card.
2. UI-store detail actions open an immediate detail shell from the selected homepage card when available.
3. Main process resolves detail data from upstream API endpoints, not by scraping the public detail page URL.
4. `tg-get-patch-detail` currently aggregates:
   - `GET /patch?uniqueId=...` for core patch metadata
   - `GET /patch/introduction?uniqueId=...` for introduction HTML, auxiliary ids/tags/company data, and `resourceUpdateTime`
   - `GET /patch/resource?patchId=...` for resource-link cards
5. Main-process normalization extracts screenshot URLs and PV URLs from introduction HTML so the renderer can present them as dedicated sections instead of inline HTML fragments.
6. UI-store detail actions fetch the normalized detail payload first.
7. UI-store detail actions derive the final patch id from the resolved detail payload, then fetch comments and ratings with that id.
8. Late responses from stale detail opens are ignored so an older click cannot overwrite a newer selection.
9. `DetailOverlay` composes dedicated detail subcomponents to render the normalized merged data.

Detail header layout:

- the detail header only switches to the side-by-side desktop layout at wider breakpoints so mid-width windows do not crush the banner and metadata area
- primary game metadata, tags, and actions stay in the left header column
- the compact `RatingHistogram` widget occupies the spare right-side header space on desktop
- company/date and aggregate counters render in a dedicated footer strip under the header content
- info/links/board/evaluation tab bodies are now modularized as separate detail components rather than living inline in `DetailOverlay`

Detail info and links presentation:

- screenshots are rendered through a dedicated horizontal strip component instead of being left inside sanitized introduction HTML
- PV links are rendered through a dedicated panel that supports direct video URLs and common embedded-player URLs
- resource links are rendered from `/patch/resource` data and first split into `Galgame 资源` and `Galgame 补丁` tabs by `section`
- each resource tab is then grouped into official versus community sections
- the `Galgame 补丁` tab also includes a dedicated external-entry card for 鲲 Galgame 补丁 rather than mixing that site into the TouchGal resource list itself
- grouped resource headers surface the upstream `resourceUpdateTime` when available
- resource cards surface section/type/language/platform chips, note text, user identity, and one or more download links

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
- Introduction-media extraction for dedicated screenshot and PV panels
- Sectioned detail resource links sourced from `/patch/resource`
- Split renderer stores with compatibility bridge for legacy imports
- Split UI-store action modules for browse, detail, and advanced pipelines
- Modular detail overlay composition
- Advanced filtering with local multi-stage pipeline
- Rating-sort stabilization through the same local advanced dataset pipeline
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
