# Decisions

Stable architectural rules and non-obvious constraints for this repository.

## Networking

### Upstream API access goes through the main process

Why:

- avoids renderer CORS problems
- keeps cookies and normalization logic in one place

Rule:

- renderer code must use `window.api` and `TouchGalClient`
- renderer feature/store code should prefer `TouchGalClient` as the renderer-side wrapper instead of calling `window.api` directly from arbitrary components or stores

### Main-process auth token normalization owns header safety

Rule:

- sanitize and normalize persisted auth token input before using it in upstream headers
- build upstream auth cookies in the main process instead of concatenating raw renderer/user-provided strings
- keep upstream auth-cookie construction in the main process and attach that segment only when there is a valid normalized auth token
- browse/search requests may still send a `Cookie` header without auth when upstream behavior depends on non-auth preference cookies such as TouchGal NSFW mode
- renderer logout must call back into the main process so the persisted token is actually cleared

Reason:

- prevents invalid header content from poisoning upstream browse/search requests
- keeps legacy token formats and migrated disk state from breaking the app on startup
- avoids renderer-only logout that leaves upstream requests authenticated

### Main-process download metadata normalization owns upstream enum cleanup

Rule:

- normalize inconsistent upstream download metadata in the main process before it reaches renderer UI
- treat upstream download type variant `row` as the same semantic value as `raw`
- renderer labels may keep defensive fallbacks, but the canonical fix belongs in main-process normalization

Reason:

- TouchGal upstream download resources can expose inconsistent enum values such as `row` for what should render as `生肉资源`
- letting raw variants leak into renderer chips produces visibly broken labels and spreads cleanup logic across UI components
- keeping enum cleanup in the relay preserves a single source of truth for all detail/resource consumers

## Advanced Filtering

### Tags are strict filters, not search terms

Rule:

- homepage tag filtering must be done by local predicate after enrichment
- un-hydrated resources must not appear in strict tag-filtered results

Reason:

- `/search` expresses retrieval semantics
- advanced filtering requires deterministic boolean `AND`

### Main-process homepage fetching must not switch to `/search` for tags

Rule:

- `tg-fetch-resources` stays on `/galgame`
- `selectedTags` are handled locally, not forwarded as upstream tag search

Reason:

- keeps homepage browse semantics separate from search semantics
- avoids mixing retrieval behavior into strict advanced filtering

### Homepage feed tags are browse hints, not authoritative taxonomy

Rule:

- treat `/galgame` tag arrays as browse-card hints only
- do not assume homepage feed tags are complete enough for strict tag semantics
- when correctness matters, use `/patch/introduction` enrichment instead of stretching feed tags beyond what upstream guarantees

Reason:

- live upstream feed items can expose only a small tag subset while `/patch/introduction` exposes the fuller tag set for the same resource
- this distinction explains why homepage cards may show fewer tags than the detail overlay
- documenting the difference prevents future regressions where card UI assumptions leak into filtering logic

### Dedicated search stays keyword-oriented

Rule:

- the dedicated search page should use upstream search semantics, not homepage advanced-filter semantics
- search page input should be treated as keyword-oriented fuzzy search
- search scope toggles may expose upstream retrieval fields such as alias, introduction, and tag
- search page may expose its own NSFW-domain control, but that control remains search-local and must not mutate homepage browse state
- search sort controls may expose upstream-supported sort fields directly
- search-page `rating` sort should not trust upstream search `rating` ordering as the final source of truth
- search-page `rating` sort should expose visible in-page rebuild progress so users can distinguish candidate fetch from the final local reorder stage
- search-page `rating` sort should publish partial local results during rebuild instead of waiting for the full candidate set
- app-level left-nav navigation should survive renderer refresh and reopen the last selected primary section
- do not route search-page queries through the homepage advanced pipeline

Reason:

- search is retrieval-oriented and intentionally looser than homepage advanced filtering
- keeping search separate avoids mixing fuzzy lookup behavior with strict boolean browse constraints
- Search-page NSFW mode is still an upstream retrieval concern, but it belongs to the dedicated search surface rather than to homepage-owned query state
- upstream search `rating` ordering can return severely incomplete result sets, so search-page `rating` sort must be rebuilt locally from a more stable candidate fetch
- because that rebuild can span many upstream pages, a generic loading spinner is not enough feedback for the dedicated search page
- once local candidate accumulation starts, blocking pagination until the rebuild fully finishes defeats the purpose of timely rendering
- primary left-nav restore is cheap renderer-owned UX state and should not reset users back to `home` on every refresh

### Renderer auth state must be revalidated on startup

Rule:

- do not treat persisted renderer `user` objects as authoritative login state across app restart
- renderer startup should revalidate session through the main-process relay, then rebuild auth state from `getUserStatusSelf()` / `getUserStatus(...)` only when that real session is valid
- if startup session validation fails, clear renderer auth state instead of leaving the app in a stale logged-in presentation

Reason:

- the real TouchGal session lives in the main-process token/cookie layer, not in renderer local storage
- stale persisted renderer auth can make the app look logged in while discussion/rating endpoints still fail with session-expired behavior
- startup revalidation keeps visible auth state aligned with the actual request credentials used by detail social endpoints

### Local and cloud favorites stay parallel, not merged

Rule:

- the `favorites` page should continue to present local collections and cloud favorite folders as separate domains
- local collection organization UX such as bulk select, move, copy, and remove belongs to the local overlay flow only
- opening a game from a collection overlay must stack the shared detail overlay above that collection surface instead of replacing it or rendering beneath it
- cloud-folder writes should preserve the upstream folder model instead of pretending cloud folders are just another local collection row
- create controls may live near each domain header, but destructive folder deletion should stay attached to the specific folder card being removed rather than to a generic shared header action

Reason:

- local collections are SQLite-backed and writable offline, while cloud folders are upstream-owned and currently read-only in this app
- forcing a merged abstraction would blur auth requirements and complicate fast local-management flows
- stacked modal behavior preserves context so users can inspect a game and return to the same collection management state
- destructive card-level placement reduces ambiguity about which folder will be deleted and pairs naturally with confirmation copy

### Cloud favorite mutation uses upstream toggle semantics, not bespoke add/remove endpoints

Rule:

- cloud favorite item writes must go through upstream `PUT /patch/favorite { patchId, folderId }`
- renderer code should treat that API as a toggle, not as a guaranteed add-only or remove-only primitive
- move operations between cloud folders should be implemented as `ensure added to target` followed by `remove from current`
- batch cloud mutations may compose repeated toggle calls serially when correctness is more important than throughput

Reason:

- the current upstream product exposes one toggle endpoint for folder membership rather than separate dedicated add/remove routes
- naïvely calling the toggle endpoint once during a move can accidentally remove an already-present target relation instead of preserving it
- explicit add-then-remove sequencing is easier to reason about than optimistic local rewrites for cross-folder cloud moves

### Cloud folder create/delete should use the upstream folder endpoints directly

Rule:

- cloud folder creation should use upstream `POST /user/profile/favorite/folder`
- cloud folder deletion should use upstream `DELETE /user/profile/favorite/folder?folderId=...`
- after create or delete, renderer should refresh cloud folder lists so counts and cards stay aligned with upstream state

Reason:

- folder lifecycle is owned by upstream TouchGal, not by the local SQLite layer
- using the same endpoints as the reference web product reduces behavioral drift
- explicit post-mutation refresh keeps Favorites and Profile views from showing stale folder counts

### Stage ownership is fixed

- Stage 1 fields belong upstream
- Stage 2 fields belong to local pure predicates
- Stage 3 belongs to detail enrichment, authoritative release-date hydration, and strict tag matching

Do not re-apply Stage 1 fields inside the local predicate.

### Release-year filtering must use release date, not resource creation time

Rule:

- compute advanced release-year filtering from `releasedDate` / introduction `released` only
- do not fall back to resource `created` time when evaluating `yearConstraints`
- if homepage list data omits `releasedDate`, advanced mode must hydrate `/patch/introduction` before applying `yearConstraints`

Reason:

- TouchGal detail pages expose resource publish time and game release time as separate concepts
- using `created` as a fallback silently turns “发行年份筛选” into “资源发布时间筛选”
- correct release-year filtering requires the introduction payload when list data is incomplete

## UI / Interaction

### Split store modules are now the source of truth

Rule:

- new renderer state logic should be added to `authStore.ts`, `uiStore.ts`, `uiStoreTypes.ts`, or `uiActions/*`
- do not treat `useTouchGalStore.ts` as the implementation source of truth anymore
- `useTouchGalStore.ts` exists only as a compatibility bridge for older imports

Reason:

- the previous single-file store mixed auth, browse, detail loading, and advanced pipeline logic in one place
- the split store layout reduces coupling and makes future refactors safer

### Homepage query state is store-owned

Rule:

- homepage sorting and upstream browse query fields belong to store state, not component-local state
- `lastHomeQuery` is the canonical homepage query object
- homepage persistence for query/page restore uses renderer `localStorage`
- homepage mount effects must wait for persisted state hydration before issuing a normal-mode fetch

Reason:

- avoids split-brain state between React local state and persisted browse state
- keeps normal-mode fetches and advanced-mode transitions consistent
- prevents refresh from silently falling back to page `1` and default sort before persisted state is available

### Page changes should reset the visible scroll position

Rule:

- homepage and dedicated search pagination must scroll the shared app content container back to the top when `currentPage` changes
- do not rely on dead selectors or per-page ad hoc scroll targets

Reason:

- browse and search both paginate inside the same app-level scrollable section
- without a reliable scroll reset, “next page” can strand the user in the middle or bottom of a freshly loaded result set

### Homepage query orchestration belongs in feature modules, not page components

Rule:

- homepage query merge rules, advanced-mode decisions, and draft synchronization should live in `features/home/*`
- `Home.tsx` should remain a page container that composes toolbar, pagination, and result UI

Reason:

- reduces coupling between visible homepage UI and non-trivial query semantics
- keeps state transitions testable and reusable without page-component churn

### Upstream homepage filters belong in homepage chrome

Rule:

- `nsfwMode`, `selectedPlatform`, and `minRatingCount` should be exposed directly from the homepage top bar
- the advanced filter panel should only own midstream and downstream constraints
- `minRatingCount` should remain an upstream `/galgame` filter and must not, by itself, force advanced mode

Reason:

- these three fields are upstream API inputs, not local advanced-processing inputs
- separating them from the advanced panel makes the browse model easier to understand and reduces unnecessary advanced-mode mental overhead

### Rating sort uses the local advanced pipeline

Rule:

- treat `sortField === 'rating'` as an advanced-mode trigger
- do not rely on upstream `rating asc/desc` pagination as the source of truth for page ordering
- build or reuse the advanced candidate catalog, then sort and paginate locally
- document clearly that the local rating pipeline stabilizes ordering and deduplication, but does not guarantee completeness if the upstream rating candidate fetch is itself incomplete

Reason:

- upstream rating pages can duplicate or reshuffle items across page boundaries
- the advanced pipeline already provides bounded page fetches, dataset reuse, stale-session cancellation, and local pagination
- keeping rating sort inside the advanced pipeline avoids a second competing mode with overlapping cache/session behavior
- if upstream rating candidate retrieval omits resources entirely, no renderer-side pagination fix can reconstruct those missing inputs

### Advanced resume is checkpoint-based, not coroutine-based

Rule:

- pausing an advanced build should cancel the active session, not attempt to suspend a JavaScript call stack
- dataset caches should retain explicit progress checkpoints for unfinished advanced work
- catalog resume should continue from unfinished page numbers
- enrichment resume should continue from unfinished resource ids

Reason:

- the advanced pipeline is a bounded-concurrency async task graph, not a single resumable coroutine
- explicit checkpoints are easier to reason about, test, and persist than trying to emulate stack suspension semantics in renderer code
- this keeps resume behavior accurate without requiring a separate worker/job-engine rewrite yet

### In-progress advanced rendering must respect the user's current page

Rule:

- background advanced-build progress updates must re-apply filters/sort against the current advanced page, not force the result view back to page `1`
- only clamp the page when the filtered result size makes the current page invalid

Reason:

- advanced mode intentionally renders incrementally while the catalog or enrichment pipeline is still running
- snapping back to page `1` defeats the purpose of incremental rendering and breaks user navigation during long builds

### Detail data must be resolved from the final patch id

Rule:

- detail comments and ratings must be fetched only after the resolved detail payload is available, using the final patch id from that payload
- do not rely solely on the homepage card id when loading detail-side discussion or evaluation data
- stale detail responses must be ignored if the user has already opened another resource

Reason:

- homepage cards may not always carry the final id needed by comment/rating endpoints
- without request guarding, slower earlier detail requests can overwrite the currently open game

### Detail social recovery must not overwrite resolved detail data

Rule:

- if a user logs in while a detail overlay is already open, the follow-up refresh should target discussion/evaluation data only
- post-login social refresh must not replace or downgrade the already resolved `selectedResource`
- automatic social recovery should trigger once on the login transition, not as a general-purpose retry loop
- failed social recovery under an invalid session must settle into a locked state instead of immediately retriggering itself

Reason:

- the detail shell and the resolved detail payload are not interchangeable; writing the shell back over resolved detail data visibly regresses the overlay
- a state-driven retry loop can hammer `/patch/comment` and `/patch/rating` while keeping the detail overlay stuck in loading
- users need a deterministic “log in, refresh once, then either unlock or stay locked” interaction model

### Detail normalization belongs in the store, not the overlay render path

Rule:

- merge detail payloads into a normalized `selectedResource` shape before rendering
- avoid using repeated `as any` field fallbacks inside detail presentation components

Reason:

- keeps the overlay focused on presentation instead of data repair
- reduces renderer drift between partially loaded shells and resolved detail payloads

### Detail histogram is a dedicated component

Rule:

- keep the rating-distribution chart in its own component and compose it into the detail header
- desktop layout should use the spare right-side header space for the compact histogram instead of pushing it into the main content flow

Reason:

- isolates chart rendering from the rest of the overlay logic
- keeps the detail header visually balanced while preserving the main tab content area

### Detail overlay should be a composition root, not a monolith

Rule:

- `DetailOverlay.tsx` should compose dedicated subcomponents for header, tabs, info, links, board, evaluation, and image-viewer concerns
- do not move large blocks of tab-specific rendering logic back into the overlay container
- detail secondary-click behavior should remain preference-driven through renderer state, with `back` as the default desktop behavior

Reason:

- keeps detail presentation changes localized
- avoids mixing tab UI, session gating, and content-specific markup in one large component

### Full-screen screenshot viewing should stay list-aware

Rule:

- the full-screen screenshot viewer should receive the whole screenshot list plus the active index, not only a single image URL
- expanded screenshot viewing must support previous/next navigation by both on-screen controls and keyboard left/right arrows
- banner zoom may still use the same viewer shell as a single-image case

Reason:

- once the user expands one screenshot, forcing them to close and re-open for every adjacent image is poor detail-media UX
- list-aware navigation keeps the screenshot strip and the full-screen viewer aligned as two views of the same dataset
- keyboard navigation is an expected desktop affordance for image viewers inside an Electron app

### Detail discussion and evaluation are gated content, not empty content

Rule:

- discussion and evaluation tabs should present a blurred locked state when the user is logged out
- the same locked state should also be used when upstream reports `SESSION_EXPIRED` or equivalent invalid-cookie failures
- do not fall back to generic empty-state messaging for those auth-gated social surfaces

Reason:

- “暂无内容” is misleading when content exists but the viewer lacks a valid session
- reusing the same locked presentation for logged-out and expired-session cases keeps the UX consistent and easier to reason about

### Settings-owned interaction preferences should stay renderer-side

Rule:

- interaction preferences such as `detailSecondaryClickAction` belong in persisted renderer UI state
- settings UI may expose `back` versus `native` behavior for detail-page secondary click without involving the main process
- detail right-click back handling must exempt interactive targets such as links and buttons so users do not lose native context behavior where it is expected
- keyboard close behavior should remain layer-aware: `Escape` closes the full-screen screenshot viewer first, then closes the detail overlay when no deeper layer is open

Reason:

- this behavior is local UX policy, not an upstream/network/runtime concern
- renderer-side persistence keeps the setting reactive and cheap to change
- exempting interactive targets preserves expected desktop affordances while still supporting fast back navigation
- layer-aware `Escape` handling matches desktop image-viewer and modal expectations better than collapsing multiple layers at once

### Collection overlays are management surfaces, not plain viewers

Rule:

- local and cloud collection overlays should provide direct organization actions in-context instead of forcing users back to the page grid for every change
- card-level selection affordances should be explicit and visually separated from destructive actions
- destructive actions should stay spatially distinct from the primary `open detail` action
- collection overlays should refresh their parent folder counts after mutation so summary cards and modal contents do not diverge

Reason:

- these overlays are where users spend time reorganizing folders, not just reading contents
- mixing select, open, and delete into the same visual slot creates avoidable misclick risk
- count drift between overlay contents and parent summary cards makes folder management feel unreliable

### Favorites page must avoid nested interactive containers

Rule:

- folder cards that contain secondary destructive actions should not use a single outer `<button>` wrapper
- use a non-button container with separate child buttons for `open` and `delete` actions when both exist on the same card

Reason:

- nested `<button>` markup is invalid HTML and causes React hydration/runtime warnings
- splitting targets keeps keyboard/focus behavior correct while preserving the card-level interaction model

### Profile loading should never be visually silent

Rule:

- the profile root route should show a dedicated loading indicator while resolving self identity and the profile payload
- comments, ratings, and collections tabs should also render an in-panel loading state during activity fetches instead of leaving stale or blank content behind

Reason:

- profile data is session-gated and commonly slower than ordinary browse-card data
- silent blank states are hard to distinguish from broken auth/session restore behavior

### Homepage cards are scan-first browse components

Rule:

- homepage cards should optimize title legibility and scan density over metadata exhaustiveness
- keep browse cards compact: inline tag chips, bare stat icons, and hover-revealed edge actions are preferred over heavy boxed subpanels

Reason:

- homepage cards are consumed in dense grids, not as full detail summaries
- the feed metadata available at browse time is intentionally lighter than the fully enriched detail payload
- tighter browse cards reduce layout noise and improve title recognition in long lists

### Detail media should be extracted from introduction HTML before rendering

Rule:

- screenshot and PV blocks embedded inside upstream introduction HTML should be normalized into dedicated renderer fields
- the introduction body shown in the info tab should strip those embedded media blocks instead of duplicating them inline

Reason:

- upstream detail data currently hides screenshots and PV links inside introduction HTML fragments
- dedicated components provide better layout control, image viewing, and video fallback behavior than raw inline HTML

### Detail resource links should be sourced from `/patch/resource` and sectioned before grouping

Rule:

- detail resource cards should be built from `/patch/resource?patchId=...`, not `/patch/download`
- the links tab should first split resources by upstream `section` (`galgame` versus `patch`)
- each section view should then present official resources and community resources in separate grouped containers
- the external 鲲补丁入口 should be rendered as its own external-link card in the patch section, not merged into the TouchGal `/patch/resource` list
- resource cards should surface user identity and resource metadata rather than collapsing everything to a raw URL list
- `resourceUpdateTime` should be carried through from `/patch/introduction` and shown at the grouped-resource level when present
- section/type/language/platform chips should be normalized with field-aware label maps before rendering
- duplicate chip labels should be removed after normalization so `section=galgame` and `type=pc` do not both show as `PC游戏`

Reason:

- `/patch/resource` is the API shape used by the reference TouchGal web architecture for downloadable resources
- upstream resource metadata values are often raw English codes rather than user-facing labels
- field-aware normalization preserves distinctions such as `section=android` -> `手机游戏` versus `platform=android` -> `Android`
- the reference web UI uses section tabs before trust-level grouping
- the grouped presentation gives users the same trust and provenance cues as the upstream product without conflating TouchGal-hosted data and external patch-site navigation

### Advanced tag state has one source of truth

Rule:

- advanced tag constraints are owned by `advancedFilterDraft.selectedTags`
- do not maintain a second standalone renderer tag list for the same filters

Reason:

- prevents tag-chip UI, filter bar UI, and advanced-mode predicate logic from drifting apart

### Exiting advanced search must clear constraints and refresh normal browse

Rule:

- the advanced-mode exit action must clear advanced constraints, reset advanced-mode UI state, and trigger a normal homepage refresh
- preserving sort order is allowed on exit
- if the current sort field is `rating`, exit should rewrite it to a normal-mode-safe field such as `created` instead of immediately routing back into the local advanced pipeline

Reason:

- users expect “退出高级模式” to return to ordinary browsing immediately, not only flip an internal mode flag

## Local Persistence

### SQLite scope is intentionally deferred

Rule:

- do not assume every upstream resource or detail payload should be persisted just because a schema/table exists
- upstream TouchGal browse/detail responses remain the source of truth for now
- add durable SQLite persistence only when a concrete local consumer is defined, such as offline browse, cache invalidation, download orchestration, local library linking, or user-authored metadata
- when in doubt, prefer not persisting a resource payload yet

For now, safe persistence targets are:

- renderer UI restore state such as homepage query/page and interaction preferences
- main-process auth/session artifacts
- download tasks and related local execution state
- local file/library links
- future personal notes, play state, and other user-authored metadata

Reason:

- the current database layer is broader than the shipped product surface
- persisting upstream resource payloads prematurely creates schema obligations, sync questions, and invalidation work before the app has a settled local-first read path
- narrowing persistence scope keeps the current implementation aligned with the actual product state

### Advanced filter execution is button-driven

Rule:

- editing advanced controls may update draft/query state immediately
- pressing `Enter` in the release-year input should only add the typed constraint
- the expensive advanced build should run only from the explicit `应用筛选` action

Reason:

- users treat the release-year input as a chip builder, not as an implicit submit control
- auto-triggering the build while entering constraints causes accidental rebuilds and misleading intermediate results

### Tag suggestion dropdown uses `onMouseDown`

Reason:

- prevents blur-before-click race when picking a suggestion

### Captcha must clear before refetch

Rule:

- set captcha state to `null` before fetching a new challenge after login failure

Reason:

- ensures React effects observe a real state transition

### Credential failure after captcha solve must not auto-chain into a new captcha

Rule:

- when captcha verification succeeds but login credentials are rejected, clear the captcha UI and return the user to the login form with the error message
- only captcha verification failure should immediately fetch a replacement captcha

Reason:

- avoids trapping the user in a repeated captcha loop when the real problem is bad credentials
- matches expected desktop-login behavior more closely

### Profile loading must settle even when self identity is incomplete

Rule:

- if `getUserStatusSelf()` returns without a usable `uid` or `id`, the renderer must still clear profile loading state

Reason:

- prevents the profile screen from getting stuck in a spinner on partial or shape-drifted upstream responses

## Build / Tooling

### Preload is bundled as CommonJS

Current build config emits preload chunks as `.cjs`.

### Electron native modules may require rebuilds

Use the documented workflow in `.agents/workflows/` when:

- `better-sqlite3` mismatches Electron ABI
- preload/main outputs are stale
- Electron cache corruption causes launch failures

## Documentation

- `README.md` is the project entry point
- `docs/` holds project documentation
- `.agents/` holds short operational guidance for future agents
