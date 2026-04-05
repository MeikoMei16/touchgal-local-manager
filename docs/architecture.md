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
  db.ts           SQLite schema bootstrap, CRUD helpers, history helpers
  extractor.ts    Archive CLI detection and extraction helpers
  downloader.ts   Download queue manager, Cloudreve resolver, concurrent file worker, post-download extraction pipeline
  utils.ts        Filesystem helpers (cleanFolderName, scanLocalLibrary)

src/preload/
  index.ts        contextBridge surface exposed as window.api

src/renderer/src/
  components/     UI
  data/           TouchGalClient window.api wrapper
  store/          Zustand stores, type boundaries, compatibility bridge, action modules
  features/       query logic, advanced-filter helpers, detail normalization
  schemas/        Zod schemas
  types/          Shared renderer-side types (ElectronAPI, BrowseHistoryEntry, …)
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
- post-download extraction pipeline (Bandizip-preferred / 7-Zip-fallback CLI)

Rules:

- Renderer must not call TouchGal upstream APIs directly.
- Normalization of inconsistent upstream payloads belongs here.
- Upstream auth cookie/header construction belongs here.
- Download metadata enum cleanup such as upstream `row -> raw` normalization also belongs here.

Session handling notes:

- the main process stores the TouchGal token under Electron `userData`
- the main process also persists the upstream auth-cookie jar under Electron `userData` so app restarts can replay the full auth context, not only the bearer token
- token input is normalized before persistence so legacy `Bearer ...`, full cookie strings, and whitespace-polluted values do not poison request headers
- upstream browse/search requests attach a `Cookie` header for the NSFW preference cookie even when there is no auth token
- auth cookie construction prefers the persisted upstream auth-cookie jar and falls back to the normalized token-derived cookie only when no cookie jar exists
- logout is finalized in the main process by clearing the in-memory token and removing persisted token files through `tg-logout`
- renderer startup must not trust previously persisted `user` objects as proof of login; it should revalidate through the main-process session instead
- if startup revalidation reports that the saved session is invalid, renderer now asks the main process to clear persisted auth artifacts so stale credentials do not loop forever

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
- [`src/renderer/src/store/localCollectionStore.ts`](../src/renderer/src/store/localCollectionStore.ts): local collections state and CRUD
- [`src/renderer/src/store/uiStore.ts`](../src/renderer/src/store/uiStore.ts): UI store assembly and persistence
- [`src/renderer/src/store/uiActions/`](../src/renderer/src/store/uiActions): browse, detail, and advanced action modules
- [`src/renderer/src/store/useTouchGalStore.ts`](../src/renderer/src/store/useTouchGalStore.ts): compatibility bridge only

Key frontend state split:

- persisted app-level left-nav tab: active primary section (`home` / `search` / `library` / `downloads` / `favorites` / `profile` / `settings`)
- persisted homepage query: `lastHomeQuery`
- persisted homepage page index: `currentPage`
- advanced draft state: `advancedFilterDraft`
- advanced datasets and progress: `advancedDatasetsByDomain`, `advancedBuildProgress`
- advanced checkpoint state inside each dataset cache: `catalogTotalPages`, `catalogCompletedPages`, `enrichmentCompletedIds`
- current result view: `resources`, `totalResources`, `currentPage`, `homeMode`
- auth modal state: captcha payloads, login errors, and session-expired UI state
- local collection state: dedicated SQLite-backed user-authored local favorites collections
- detail view state: `selectedResource`, `patchComments`, `patchRatings`, `isDetailLoading`
- persisted interaction preference: `detailSecondaryClickAction`
- persisted download-directory override: `downloadPathOverride`
- transient global toast viewport state: `toasts`

Renderer code split:

- homepage query rules and controller: [`src/renderer/src/features/home/homeQuery.ts`](../src/renderer/src/features/home/homeQuery.ts), [`src/renderer/src/features/home/useHomeQueryController.ts`](../src/renderer/src/features/home/useHomeQueryController.ts)
- dedicated search page UI: [`src/renderer/src/components/SearchView.tsx`](../src/renderer/src/components/SearchView.tsx), [`src/renderer/src/components/SearchOptionsPanel.tsx`](../src/renderer/src/components/SearchOptionsPanel.tsx)
- advanced-filter pure helpers: [`src/renderer/src/features/home/advancedDataset.ts`](../src/renderer/src/features/home/advancedDataset.ts)
- detail normalization helpers: [`src/renderer/src/features/detail/detailResource.ts`](../src/renderer/src/features/detail/detailResource.ts)
- detail overlay subcomponents: [`src/renderer/src/components/detail/`](../src/renderer/src/components/detail)
- Favorites page: [`src/renderer/src/components/FavoritesView.tsx`](../src/renderer/src/components/FavoritesView.tsx)
- Downloads page: [`src/renderer/src/components/DownloadsView.tsx`](../src/renderer/src/components/DownloadsView.tsx)
- Profile page (includes browse history tab): [`src/renderer/src/components/ProfileView.tsx`](../src/renderer/src/components/ProfileView.tsx)

Renderer persistence notes:

- active left-nav tab is persisted in renderer `localStorage` so refresh returns to the same primary section
- homepage UI state is persisted through Zustand in renderer `localStorage`
- auth UI state is persisted separately from the encrypted token managed by the main process
- local collections are persisted in SQLite via main-process CRUD rather than renderer `localStorage`
- renderer auth persistence is intentionally narrow and must not treat stored `user` profile data as authoritative session state across app restart
- renderer logout must clear both layers: renderer auth state and the main-process token
- persisted homepage state is intentionally narrow: `lastHomeQuery` and `currentPage`
- renderer interaction preferences such as `detailSecondaryClickAction` are also persisted in renderer `localStorage`
- renderer download-directory override is persisted in renderer `localStorage`, while the default archive path is resolved by the main process to project-root `download/`; extracted games are placed under project-root `library/`
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
- collection-card quick-download buttons reuse a shared renderer helper that resolves official TouchGal game resources on demand
- detail links panel reuses the same official/community download classification: official resource actions enqueue downloads in-app, while community resource actions remain external-link launches
- Library linked-game cards use a local-filesystem-first primary action: the card button reveals the real local directory in the OS file browser instead of opening TouchGal detail

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
3. The main process restores both the normalized token and any persisted upstream auth cookies before that self-status request runs.
4. If self-status fails or returns no usable id, renderer clears auth state so the app does not present a stale logged-in UI.
5. If the failure is a true restore failure, renderer also clears persisted auth artifacts in the main process so the next startup does not keep replaying a known-bad session.
6. This keeps detail discussion/rating gating aligned with the real main-process session after app restart.

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
6. The homepage `收藏` hover tab now opens a card-local quick-collect surface instead of forcing a detail-overlay jump.
7. That quick-collect surface can overflow beyond the card bounds and float over the homepage grid, while the card body itself keeps its original rounded clipping.
8. Quick-collect automatically chooses whether to open left or right based on the card's viewport position so cards on the right half do not push the panel off-screen.
9. Quick-collect currently supports direct local collection toggle, inline local-folder creation, login-gated cloud-folder toggle, and per-row loading/error feedback without leaving the homepage.
10. The homepage `下载` hover tab now opens a floating quick-download panel instead of jumping directly to the detail links tab.
11. That quick-download panel loads only TouchGal official `galgame` resources and queues them directly into the dedicated Downloads page.
12. Quick-download entries now render the normalized metadata-chip set from the detail links model, including section/type/language/platform and extraction-code badges when available, instead of a single compressed text line.
13. The shared quick-download popover used outside the homepage card rail now uses a wider fixed panel so full titles and chip rows remain readable.

Detail links panel behavior:

1. The links tab still shows both official and community resources from the detail payload.
2. Resource cards reuse the shared official/community classification helper from `features/downloads/downloadHelpers.ts`.
3. Clicking the primary download action on a TouchGal official resource enqueues the resolved links into the Downloads page using the same queue IPC path as quick download.
4. Clicking the primary download action on a community resource still opens the upstream URL externally instead of routing it through the in-app downloader.

Library behavior:

1. The Library page is intentionally local-first rather than detail-first.
2. Linked game cards surface the real local install path as visible metadata.
3. The primary card action reveals that local path in the system file browser instead of jumping into the TouchGal detail overlay.
4. Launch actions remain separate from reveal-in-folder actions so directory browsing and process launch are not conflated.

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
6. Successful login may also rotate additional upstream auth cookies; those are now persisted together with the token for later restore.

Favorites architecture:

1. The `favorites` primary nav now owns a dedicated page rather than reusing homepage browse UI.
2. Favorites are modeled as two parallel domains instead of one merged abstraction.
3. Local collections are always available, stored in SQLite, and writable without login.
4. Cloud favorite folders remain upstream-owned and are shown as a login-gated companion section when logged in.
5. Clicking a cloud favorite folder now opens a paginated overlay that fetches folder contents from `/user/profile/favorite/folder/patch`.
6. That cloud-folder content flow mirrors the current `kun-touchgal-next` pattern: folder list first, folder contents second.
7. Detail-header favorite interaction opens a menu that prioritizes local collection add/remove actions and also surfaces current cloud folder visibility state.
8. Local collection item writes upsert the minimal game shell into SQLite before linking the game to a collection so collection foreign keys do not depend on broader browse-cache rollout.
9. Opening a local collection now uses a dedicated gallery-style overlay with per-card quick actions instead of a plain list.
10. Local collection cards support inline `move`, `copy`, and `remove` workflows so users can reorganize a folder without leaving the overlay.
11. Local collection overlays also support bulk select for `move`, `copy`, and `remove` against the current filtered result set.
12. Detail overlays intentionally stack above collection overlays so opening a game from inside a collection behaves like a second-layer drill-down instead of disappearing underneath the parent modal.
13. Cloud favorite folders are no longer browse-only: the cloud overlay now supports per-card removal from the current folder through the upstream `PUT /patch/favorite` toggle API.
14. Cloud favorite overlays also support multi-select, batch remove from the current folder, and batch move into another cloud folder by composing `add to target folder` plus `remove from current folder`.
15. Cloud-card quick actions use the same toggle API carefully: move first ensures the game exists in the target folder, then removes it from the current folder so a pre-existing target relation does not accidentally duplicate or cancel itself.
16. Favorites and Profile both pass the current cloud-folder list into the overlay so single-item and batch cloud moves can choose any sibling folder without fetching an extra list inside the modal.
17. Cloud overlay mutations trigger parent refresh so folder counts in Favorites and Profile stay aligned with the overlay's current contents.
18. The cloud overlay UI has been reorganized into a compact gallery-management card style: full-but-contained banner art, top-right selection affordance, bottom-right destructive action, and a dedicated action tray for open/move/remove workflows.
19. The main Favorites page now keeps creation controls close to each domain header instead of concentrating all create actions in one shared top-right panel.
20. Local Favorites header supports inline local-folder creation, while each local folder card owns its own delete affordance with a confirmation dialog.
21. Cloud Favorites header supports inline cloud-folder creation plus a Chinese `公开 / 私有` visibility toggle beside the create button.
22. Cloud folder deletion is now exposed from each cloud folder card, not from a shared header-level delete control, so the destructive action is visually bound to the folder it will remove.
23. Both local and cloud folder deletion paths use a shared confirmation dialog that explicitly states the folder and all folder-item relations will be removed.
24. To avoid invalid nested interactive markup, cloud folder list cards now render as non-button containers with separate open and delete button targets.
25. The detail-header cloud favorites section now fetches `/user/profile/favorite/folder` with both `uid` and `patchId` when the menu opens, mirroring the upstream site so each folder row carries membership state for the current game.
26. That detail-header cloud list behaves as a true toggle: clicking a folder adds the current game when absent and removes it when already present, matching the local collection mental model and the upstream `isAdd` UX.
27. Detail-header cloud-folder rows also render per-row in-flight feedback so slow network IO does not look like a dead click target.
28. Local collection cards and cloud collection cards now expose the same official quick-download action as homepage cards, but their floating panel is implemented through a shared body-level portal so it can escape nested card/overlay clipping.

Browse history flow:

1. Opening any game detail overlay triggers a fire-and-forget `window.api.recordHistory(...)` call inside `detailActions.ts` after the resolved detail payload is available.
2. The main process upserts the entry into `browse_history` by `unique_id` (repeat visits update `viewed_at` rather than inserting a duplicate row).
3. History is trimmed to the 500 most recent entries server-side on each record call.
4. The Profile page exposes a **History** tab that is the default tab and is available even without login.
5. History is rendered as a clickable card grid (banner + name + relative timestamp); clicking a card opens the full detail overlay.
6. Users can clear all history via a confirmation-gated button on the History tab.

Profile loading:

1. Renderer resolves the self identity through `getUserStatusSelf()`.
2. If a usable `uid` or `id` is present, renderer fetches the full profile with `getUserStatus(uid)`.
3. If self-status resolves without a usable id, profile loading must still settle back to a non-loading state instead of hanging the screen.
4. The profile root view now renders an explicit loading circle during the initial profile load instead of leaving the user on a silent blank surface.
5. The comments, ratings, and collections tabs also render their own activity-level loading indicator while the corresponding user activity request is in flight.
6. The History tab renders independently of login state and loads from local SQLite on mount.

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
12. After a successful detail load, `detailActions.ts` fires `window.api.recordHistory(...)` to record the visit in local browse history.

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

Download queue flow:

1. Renderer quick-download surfaces resolve official TouchGal `galgame` resources lazily from `/patch/resource` through the existing detail payload path.
2. The renderer sends queue requests to the main process with the chosen source URL and the current download directory.
3. The main-process download manager detects Cloudreve share URLs and resolves them into one or more presigned object-storage file URLs.
4. Single-file shares are resolved by `PUT /api/v3/share/download/<key>`.
5. Directory shares are resolved by listing `GET /api/v3/share/list/<key>/?path=...` and then resolving each file individually with `PUT /api/v3/share/download/<key>?path=...`.
6. Each resolved file becomes its own persisted SQLite `download_tasks` row with output path, progress bytes, status, and error state.
7. The downloader runs a small concurrent worker pool instead of a single-file serial queue.
8. The worker-pool concurrency limit is persisted in SQLite, exposed in Settings, and applied immediately when the user changes it.
9. Before resume/retry, Cloudreve source URLs are refreshed so expired presigned object URLs do not strand old tasks.
10. File downloads use HTTP range requests when partial files already exist, so pause/resume and retry can continue from local bytes already on disk when the upstream object server still permits range requests.
11. The dedicated Downloads page subscribes to pushed queue snapshots from the main process, renders per-file progress, and exposes pause, resume, retry, delete, clear-finished, reveal-in-folder, and batch-selection actions.
12. Batch delete can remove both the selected task records and their on-disk files, but only when those files resolve inside the currently active download root; extracted `library/` outputs are intentionally out of scope.
13. Download queue items also surface extraction follow-up state through `status`, `error_message`, and `extracted_path`.

Post-download extraction pipeline:

1. When a download task transitions to `status = 'done'`, the downloader calls `extractAndLink()` fire-and-forget.
2. `extractAndLink` only runs if the file has a known archive extension (`.zip`, `.rar`, `.7z`, `.001`) and passes `isFirstPartOrSingle()` — multi-part continuations (`.part2.rar`, `.002`, etc.) are skipped.
3. The main process probes supported archive CLIs in priority order: Bandizip CLI (`bz.exe`) first, then 7-Zip CLI (`7z` / `7z.exe`) as a fallback. If neither is available, extraction is silently skipped and the archive remains on disk.
4. Password is resolved by probing in order: `""` → `"touchgal"`. Bandizip uses `bz l` and 7-Zip uses `7z t` / `7z l`; both paths also derive an expected extracted file count for post-extract verification.
5. Extraction runs through the selected CLI (`bz x ...` or `7z x ...`). File count is verified after extraction; mismatches delete the partial output and set an error message.
6. The final extraction target lives under the dedicated project-root `library/` directory; if `library/Game Name` already exists, the downloader allocates `library/Game Name (2)`, `library/Game Name (3)`, and so on rather than deleting or overwriting an existing install.
7. On success, the extracted folder is renamed to the sanitised game name from the `games` table (if `gameId` is known), receives a `.tg_id` file, and is inserted into `local_paths` with `source = 'download'`.
8. `download_tasks.extracted_path` is updated to the final extracted folder path.
9. Status transitions: `done` → `extracting` → `done` (with `extracted_path`) on success, or `done` (with `error_message`) on any failure.

Local game library architecture:

1. The `games` table acts as the central identity hub; `local_paths`, `collections`, and `download_tasks` all reference it.
2. `library_roots` stores user-owned watch directories for the Library page, auto-seeds the default project-root `library/` directory, and records `last_scanned_at` after rescans.
3. `local_paths` now carries `source` (`scan` / `download` / `manual`), `status` (`discovered` / `linked` / `verified` / `broken`), and `last_verified_at`.
4. The `.tg_id` marker file written into extracted folders allows future library scans to directly link a folder to its `games` row without FTS matching.
5. Library scans are bounded-recursive up to 3 levels below each watched root; a folder becomes a candidate when it contains either a `.tg_id` marker or one or more discovered executables.
6. Candidate folders are classified as `linked` (valid `.tg_id` that maps to a known game), `orphaned` (has `.tg_id` but no matching known game), or `unresolved` (no `.tg_id`, but looks launchable).
7. Existing scanned `local_paths` that disappear from currently watched roots are marked `broken` instead of being deleted immediately, so the UI can surface stale paths for repair.
8. The Library page is intentionally library-first: the main area shows linked local games, a side panel groups `orphaned` / `unresolved` / `broken` items under "Needs Attention", and watched roots remain a secondary management panel.
9. Linked local games can open the shared TouchGal detail overlay and can also launch locally through `tg-get-executables` / `tg-launch-game`, using a saved executable when known or asking the user to choose when multiple `.exe` files are found.
10. Matching pre-existing local game folders from unknown sources (renamed, no `.tg_id`) to TouchGal entries is **explicitly deferred** to a later sprint.

## Local Persistence

SQLite is initialized in [`src/main/db.ts`](../src/main/db.ts).

Current schema areas include:

- `games` + `games_fts` (FTS5)
- `companies`
- `tags` + `game_tags`
- `external_ids`
- `local_paths` (path UNIQUE, source, status, last_verified_at)
- `library_roots` (persisted scan/watch directory list)
- `media_cache`
- `download_tasks` (extracted_path)
- `play_sessions`
- `personal_metadata`
- `collections` + `collection_items`
- `browse_history` (unique_id UNIQUE, game_id, name, banner_url, viewed_at)

Status note:

- SQLite is now intentionally used for user-owned local features with a clear persistence boundary, including local collections, download tasks, and browse history.
- Browse/detail/resource metadata remains network-first and is **not** promoted to SQLite as the source of truth.
- The schema is broader than currently shipped UI features.
- Some tables support planned local-first capabilities that are only partially wired today.
- Database-backed resource persistence is intentionally deferred for now; the app still treats upstream API responses as the source of truth for homepage browsing and detail loading.
- **Do not treat the presence of a table as a requirement to persist that upstream resource yet.**
- Near-term persistence should stay narrow and local-first:
  - renderer UI restore state
  - main-process auth/session artifacts
  - local collections
  - download queue state + extraction state
  - browse history (user-authored visit record)
  - local installation/link metadata
  - explicitly user-authored local metadata once that UI is implemented

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
- Persisted download queue with Cloudreve share resolution, concurrent workers, and per-file task controls
- Dedicated Favorites page with parallel local and cloud collection domains
- SQLite-backed local collection CRUD and detail-header add/remove integration
- Local collection gallery overlay with single-item and batch move/copy/remove flows
- Cloud favorite folder browsing through `/user/profile/favorite/folder/patch`
- Cloud favorite folder creation through `/user/profile/favorite/folder`
- Cloud favorite folder deletion through `DELETE /user/profile/favorite/folder`
- Cloud favorite folder mutation through `/patch/favorite`
- Cloud overlay batch management for move/remove across sibling cloud folders
- Profile and Favorites cloud-folder overlays that stay count-synchronized after mutation
- Layer-correct modal stacking for collection overlay -> detail overlay drill-down
- Explicit loading indicators for profile shell and profile activity tabs
- Shared destructive confirmation dialog for local and cloud folder deletion on the Favorites page
- Homepage quick-collect popover for local/cloud folder toggle directly from the browse card hover rail
- **Browse history** — SQLite-backed, recorded on every detail open, shown in Profile History tab (default tab, login-not-required), clearable
- **Post-download extraction pipeline** — Bandizip-preferred / 7-Zip-fallback CLI detection, 2-tier password probe, multi-part handling, file-count verification, folder rename, `.tg_id` injection, `local_paths` insertion
- **Local Library manager** — auto-seeded `library/` watch root, library-first linked-game layout, native directory picker, bulk rescan across saved roots, grouped `orphaned` / `unresolved` / `broken` attention states, and direct local launch actions
- **Download queue push updates** — renderer now subscribes to main-process queue snapshots instead of polling every 1.2 seconds
- **Download concurrency setting** — SQLite-backed max concurrent download setting exposed in Settings and applied in the main-process worker pool
- **Downloads bulk delete** — multi-select task deletion can also remove matching files under the active download root while leaving `library/` extraction outputs untouched

### Partial / In Progress

- Local metadata cache usage is still limited
- Library scanning is now bounded-recursive (up to 3 levels) but still intentionally avoids unknown-source auto-matching
- Offline-first search is not yet the main browse path
- Deciding which upstream resource payloads deserve durable SQLite storage is still deferred work, not a settled requirement
- Homepage rating sort can still miss resources when the upstream rating candidate feed itself is incomplete
- Cloud favorites still use upstream-owned folders only; create/delete are exposed now, but cloud-folder editing is not yet surfaced in this Electron UI
- Cloud move/remove flows are sequential and correctness-oriented; they have not been optimized into a background job queue or optimistic write model yet
- SettingsView extractor section now shows detected CLI state and effective fallback behavior, but manual extractor path override is still not implemented

### Deferred

- Unknown-source local folder matching: mapping pre-existing locally downloaded game folders (renamed, no `.tg_id`, no identifiable metadata) to TouchGal entries via FTS or online search. **Explicitly deferred until the clean downstream path is fully stable.**

## Important Constraints

- Upstream API relay lives in the main process.
- Advanced tag filtering must not depend on `/search`.
- Stage 1 advanced-filter fields should be handled upstream, not re-applied locally.
- Renderer-side advanced filtering is domain-scoped: `sfw`, `nsfw`, and `all`.
- **Always read `docs/decisions.md` before making changes** — deferred TODO blocks (e.g. `upsertGame`) must not be activated without explicit user instruction.
