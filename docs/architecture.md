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
- Download metadata enum cleanup such as upstream `row -> raw` normalization also belongs here.

Session handling notes:

- the main process stores the TouchGal token under Electron `userData`
- token input is normalized before persistence so legacy `Bearer ...`, full cookie strings, and whitespace-polluted values do not poison request headers
- upstream browse/search requests attach a `Cookie` header for the NSFW preference cookie even when there is no auth token
- the auth cookie segment is attached only when there is a valid normalized auth token to send
- logout is finalized in the main process by clearing the in-memory token and removing persisted token files through `tg-logout`
- renderer startup must not trust previously persisted `user` objects as proof of login; it should revalidate through the main-process session instead

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
- search-page keyword query and search result state
- advanced-filter orchestration
- detail overlay lifecycle
- detail header composition and rating histogram presentation
- renderer-side feature module composition

Renderer state implementation is now split:

- [`src/renderer/src/store/authStore.ts`](../src/renderer/src/store/authStore.ts): auth UI state
- [`src/renderer/src/store/uiStore.ts`](../src/renderer/src/store/uiStore.ts): UI store assembly and persistence
- [`src/renderer/src/store/uiActions/`](../src/renderer/src/store/uiActions): browse, detail, and advanced action modules
- [`src/renderer/src/store/useTouchGalStore.ts`](../src/renderer/src/store/useTouchGalStore.ts): compatibility bridge only

Key frontend state split:

- persisted app-level left-nav tab: active primary section (`home` / `search` / `library` / `favorites` / `profile` / `settings`)
- persisted homepage query: `lastHomeQuery`
- persisted homepage page index: `currentPage`
- advanced draft state: `advancedFilterDraft`
- advanced datasets and progress: `advancedDatasetsByDomain`, `advancedBuildProgress`
- advanced checkpoint state inside each dataset cache: `catalogTotalPages`, `catalogCompletedPages`, `enrichmentCompletedIds`
- current result view: `resources`, `totalResources`, `currentPage`, `homeMode`
- auth modal state: captcha payloads, login errors, and session-expired UI state
- detail view state: `selectedResource`, `patchComments`, `patchRatings`, `isDetailLoading`
- persisted interaction preference: `detailSecondaryClickAction`

Renderer code split:

- homepage query rules and controller: [`src/renderer/src/features/home/homeQuery.ts`](../src/renderer/src/features/home/homeQuery.ts), [`src/renderer/src/features/home/useHomeQueryController.ts`](../src/renderer/src/features/home/useHomeQueryController.ts)
- dedicated search page UI: [`src/renderer/src/components/SearchView.tsx`](../src/renderer/src/components/SearchView.tsx), [`src/renderer/src/components/SearchOptionsPanel.tsx`](../src/renderer/src/components/SearchOptionsPanel.tsx)
- advanced-filter pure helpers: [`src/renderer/src/features/home/advancedDataset.ts`](../src/renderer/src/features/home/advancedDataset.ts)
- detail normalization helpers: [`src/renderer/src/features/detail/detailResource.ts`](../src/renderer/src/features/detail/detailResource.ts)
- detail overlay subcomponents: [`src/renderer/src/components/detail/`](../src/renderer/src/components/detail)

Renderer persistence notes:

- active left-nav tab is persisted in renderer `localStorage` so refresh returns to the same primary section
- homepage UI state is persisted through Zustand in renderer `localStorage`
- auth UI state is persisted separately from the encrypted token managed by the main process
- renderer auth persistence is intentionally narrow and must not treat stored `user` profile data as authoritative session state across app restart
- renderer logout must clear both layers: renderer auth state and the main-process token
- persisted homepage state is intentionally narrow: `lastHomeQuery` and `currentPage`
- renderer interaction preferences such as `detailSecondaryClickAction` are also persisted in renderer `localStorage`
- hydration is explicitly gated before homepage mount effects issue a normal-mode fetch
- `uiStore.ts` owns the persistence configuration, but action implementations are delegated to `uiActions/*`

Important note:

- sorting for the homepage is store-owned, not component-local
- the dedicated search page is intentionally separate from homepage advanced filtering and uses upstream search semantics with explicit scope toggles and upstream sort controls
- search-page `rating` sort is rebuilt locally because the upstream search `rating` ordering is incomplete
- `sortField === 'rating'` is treated as an advanced-mode trigger because upstream rating pagination is unstable
- local rating-sort pagination is more stable than the upstream `rating` pages, but the current pipeline still cannot compensate for resources that the upstream rating candidate fetch never returns
- `minRatingCount` is still forwarded directly to upstream `/galgame` and does not, by itself, trigger advanced mode
- tag constraints are represented by `advancedFilterDraft.selectedTags` as the single source of truth
- release-year filtering is based on release date only; renderer code must not fall back to resource `created` time when computing release year
- normal homepage refresh should restore sort key, sort order, upstream filters, and current page from persisted state
- upstream homepage controls (`nsfwMode`, `selectedPlatform`, `minRatingCount`) are rendered directly in the homepage top bar, left of `高级筛选`
- `useTouchGalStore.ts` should be treated as a compatibility layer, not as the place to add new state logic
- `TouchGalClient.ts` is the renderer-side source of truth for the preload bridge surface used by browse, auth, and profile flows; new renderer network/IPC calls should be added there instead of reaching for `window.api` directly
- homepage cards currently render at most 3 browse tags from the feed item itself; the card does not assume feed tags are equivalent to the fuller taxonomy exposed by `/patch/introduction`
- both homepage and dedicated search now scroll the shared app content container back to top whenever pagination changes page

## Data Flow

Normal homepage browsing:

1. Renderer hydrates `lastHomeQuery` and `currentPage` from persisted UI storage.
2. Homepage fetch effects wait until hydration is complete.
3. Renderer derives a normalized homepage query from store state.
4. Renderer calls `TouchGalClient.fetchGalgameResources()`.
5. Preload forwards to `tg-fetch-resources`.
6. Main process relays to upstream TouchGal API and normalizes the response.
7. Renderer store updates `resources`, `totalResources`, and pagination state.
8. Homepage cards render directly from that browse feed data, including the limited feed tag subset when present.

Normal homepage refresh behavior:

1. Refresh recreates the renderer process.
2. App-level left-nav state restores the previously selected primary section instead of forcing navigation back to `home`.
3. Zustand rehydrates persisted `lastHomeQuery` and `currentPage`.
4. Homepage mount effects resume with the hydrated values instead of falling back to page `1` and default sort.

Search-page browsing:

1. Renderer keeps the active search keyword local to the dedicated search page instead of writing it into homepage query state.
2. Search requests call `TouchGalClient.searchResources(keyword, page, limit, options)` with keyword-oriented fuzzy matching semantics.
3. Search scope toggles currently map directly to upstream search options for alias, introduction, and tag matching, with all three enabled by default.
4. Search has its own local NSFW domain control (`safe` / `nsfw` / `all`) and forwards that through the main-process relay so the same TouchGal preference-cookie mechanism applies to dedicated search.
5. Most search-page sort controls map directly to the upstream search endpoint's supported `sortField` and `sortOrder` values.
6. The exception is `sortField === 'rating'`: search-page `rating` sort now fetches a stable non-rating candidate set from upstream search and re-sorts that candidate set locally by `averageRating`.
7. While that local rebuild is running, the search page renders explicit in-page progress for candidate-page fetch and the final local reorder stage instead of showing only a generic spinner.
8. Search-page `rating` rebuild publishes partial locally sorted results as new candidate pages arrive, so the grid can render incrementally before the full rebuild finishes.
9. In that in-progress `rating` mode, pagination works against the currently accumulated local result set instead of forcing navigation back to page `1`.
10. Search-page pagination is local to the search view and does not reuse homepage advanced-filter state.
11. Search results can still open the shared detail overlay, but search itself does not participate in the homepage advanced pipeline.
12. Search-page pagination scrolls the shared app content container back to the top on page change.

Renderer session restore behavior:

1. On app startup, renderer calls `getUserStatusSelf()` through the main-process relay instead of trusting persisted `user` state as proof of login.
2. If the main-process token is still valid, renderer rebuilds `user` and `userProfile` from the resolved self identity and profile payload.
3. If self-status fails or returns no usable id, renderer clears auth state so the app does not present a stale logged-in UI.
4. This keeps detail discussion/rating gating aligned with the real main-process session after app restart.

Advanced homepage browsing:

1. Renderer keeps the active homepage query in `lastHomeQuery`.
2. Queries that require local correctness — including `sortField === 'rating'` — enter advanced mode instead of trusting upstream pagination.
3. Entering advanced mode builds or reuses a domain-scoped local candidate dataset using only upstream coarse filters.
4. Catalog progress is checkpointed per dataset, including the known total pages and the set of finished catalog pages.
5. If strict tags or release-year constraints need authoritative introduction data, the renderer hydrates `/patch/introduction` for those candidates before final local filtering.
6. Enrichment progress is also checkpointed per dataset via the finished resource ids and failed enrichment ids.
7. Stage 2 and Stage 3 filtering are then applied locally against that dataset.
8. Local sorting and pagination update the same result view state used by normal mode.

Advanced pause / resume behavior:

1. Pausing an advanced build invalidates the active session id so in-flight async work can no longer write back into store state.
2. Already collected catalog pages and already enriched resources remain in the domain dataset cache as checkpoints.
3. Resuming an advanced build continues from the unfinished catalog pages when catalog fetch is incomplete.
4. If catalog fetch is already complete, resume continues from the unfinished introduction/tag enrichment set instead of rebuilding the whole dataset.
5. This is checkpoint-based continuation, not language-level coroutine suspension.

Advanced in-progress pagination behavior:

1. Advanced build progress updates re-apply local filters/sort against the user's current page instead of forcing page `1`.
2. Page clamping still applies if the currently selected page becomes invalid after filtering.

Homepage top bar behavior:

1. Sort controls remain on the left side of the homepage toolbar.
2. Upstream browse controls live on the right side, immediately to the left of `高级筛选`.
3. Those controls still write into `lastHomeQuery`, so they participate in the same persistence and refresh-restore path as all other homepage query fields.
4. Choosing rating sort routes the homepage through the same local advanced pipeline used by advanced filtering; there is no separate rating-only mode.

Homepage card behavior:

1. Homepage cards are scan-first browse components rather than mini detail pages.
2. Cards show at most 3 feed tags inline under the created date.
3. Stats render as a single bare icon-plus-number row instead of boxed pills.
4. `收藏` and `下载` are revealed as right-edge vertical hover tabs instead of persistent footer buttons.
5. The corner rating badge fades out on hover so the action tabs become the dominant interaction state.

Advanced filter interaction behavior:

1. Editing advanced controls updates draft/query state immediately.
2. Pressing `Enter` in the release-year field only adds the constraint chip to the draft.
3. The expensive advanced build runs only when the user clicks `应用筛选`.

Exiting advanced search:

1. Renderer clears advanced constraints and advanced-mode UI state.
2. Homepage returns to `normal` mode.
3. The reset query currently preserves Stage 1 upstream controls together with the current top-level sort field and sort order.
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
6. Main-process normalization also canonicalizes inconsistent download metadata values from `/patch/resource`, including upstream `type: "row"` variants that should render as `生肉资源`.
7. UI-store detail actions fetch the normalized detail payload first.
8. UI-store detail actions derive the final patch id from the resolved detail payload, then fetch comments and ratings with that id.
9. Late responses from stale detail opens are ignored so an older click cannot overwrite a newer selection.
10. `DetailOverlay` composes dedicated detail subcomponents to render the normalized merged data.
11. Search-page result cards pass their current card resource into the detail action as a fallback shell, so opening detail from search no longer waits for homepage-owned store state.

Detail discussion / evaluation session behavior:

1. Discussion and evaluation tabs are treated as session-gated social surfaces rather than as plain empty states.
2. When the user is not logged in, those tab bodies remain blurred/locked with a login CTA instead of rendering misleading `暂无内容` placeholders.
3. When upstream social endpoints report session expiry, the same locked presentation is forced even if renderer auth state still thinks a user exists.
4. Successful detail opens still fetch comments and ratings during the main detail action, but post-login social recovery is a separate refresh path.
5. If the user logs in while a detail overlay is already open, renderer triggers a one-shot social refresh for the currently selected resource.
6. That post-login social refresh updates only comments and ratings; it must not overwrite the resolved `selectedResource` detail payload.
7. The post-login social refresh is edge-triggered on login transition and should not loop or continuously retry while a session remains invalid.

Detail interaction behavior:

- the renderer settings page currently owns detail secondary-click behavior as a persisted interaction preference
- the default setting maps right click to back in the detail overlay and full-screen screenshot viewer
- when the screenshot viewer is not open, pressing `Escape` closes the detail overlay itself
- interactive targets such as links and buttons keep their native context behavior even when right click is mapped to back
- the full-screen screenshot viewer also supports keyboard `ArrowLeft` / `ArrowRight` navigation and on-screen previous/next arrows when multiple screenshots exist
- when the screenshot viewer is open, its own `Escape` handling closes only the viewer first rather than the underlying detail overlay

Detail header layout:

- the detail header only switches to the side-by-side desktop layout at wider breakpoints so mid-width windows do not crush the banner and metadata area
- primary game metadata, tags, and actions stay in the left header column
- the detail header's download metadata chips are derived from `/patch/resource` metadata, not from the game's content tags
- those metadata chips are normalized field-by-field into human-readable Chinese labels and deduplicated after normalization
- the compact `RatingHistogram` widget occupies the spare right-side header space on desktop
- company/date and aggregate counters render in a dedicated footer strip under the header content
- info/links/board/evaluation tab bodies are now modularized as separate detail components rather than living inline in `DetailOverlay`

Detail info and links presentation:

- screenshots are rendered through a dedicated horizontal strip component instead of being left inside sanitized introduction HTML
- clicking a screenshot opens a full-screen viewer bound to the same screenshot list, with previous/next navigation and keyboard arrow support
- PV links are rendered through a dedicated panel that supports direct video URLs and common embedded-player URLs
- the info tab shows published time, release time, resource update time, and outbound VNDB/Bangumi/Steam links as separate metadata rows
- resource links are rendered from `/patch/resource` data and first split into `Galgame 资源` and `Galgame 补丁` tabs by `section`
- each resource tab is then grouped into official versus community sections
- the `Galgame 补丁` tab also includes a dedicated external-entry card for 鲲 Galgame 补丁 rather than mixing that site into the TouchGal resource list itself
- grouped resource headers surface the upstream `resourceUpdateTime` when available
- resource cards surface section/type/language/platform chips, note text, user identity, and one or more download links
- raw upstream resource metadata codes such as `pc`, `chinese`, `zh-Hans`, and `windows` are normalized into field-aware labels such as `PC游戏`, `汉化资源`, `简体中文`, and `Windows`
- duplicate labels are removed after normalization so equivalent values from different metadata fields do not render twice in the same chip row

## Local Persistence

SQLite is initialized in [`src/main/db.ts`](../src/main/db.ts).

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
- Database-backed resource persistence is intentionally deferred for now; the app still treats upstream API responses as the source of truth for homepage browsing and detail loading.
- Do not treat the presence of a table as a requirement to persist that upstream resource yet.
- Near-term persistence should stay narrow and local-first:
  renderer UI restore state
  main-process auth/session artifacts
  download queue state
  local installation/link metadata
  explicitly user-authored local metadata once that UI is implemented

## Current Feature Status

### Implemented or Active

- Homepage resource browsing
- Homepage refresh persistence for query, sort, and page
- Login and captcha relay
- Main-process token normalization and safer upstream cookie/header assembly
- Startup session restore from main-process session validation
- Detail overlay with introduction, comments, and ratings
- Guarded detail loading that resolves comments/ratings from the final detail id
- Modular detail rating histogram component in the header
- Introduction-media extraction for dedicated screenshot and PV panels
- Sectioned detail resource links sourced from `/patch/resource`
- Search-page NSFW toggle routed through the same main-process cookie relay used by upstream browse/search
- Split renderer stores with compatibility bridge for legacy imports
- Split UI-store action modules for browse, detail, and advanced pipelines
- Modular detail overlay composition
- Advanced filtering with local multi-stage pipeline
- Checkpoint-based advanced-build resume for catalog and enrichment phases
- Rating-sort stabilization through the same local advanced dataset pipeline
- Basic SQLite bootstrap
- Basic download queue persistence and link parsing scaffold

### Partial / In Progress

- Local metadata cache usage is still limited
- Downloader is scaffolded, not full end-to-end
- Offline-first search is not yet the main browse path
- Deciding which upstream resource payloads deserve durable SQLite storage is still deferred work, not a settled requirement
- Homepage rating sort can still miss resources when the upstream rating candidate feed itself is incomplete

## Important Constraints

- Upstream API relay lives in the main process.
- Advanced tag filtering must not depend on `/search`.
- Stage 1 advanced-filter fields should be handled upstream, not re-applied locally.
- Renderer-side advanced filtering is domain-scoped: `sfw`, `nsfw`, and `all`.
