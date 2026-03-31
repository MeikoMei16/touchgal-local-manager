# Decisions

Stable architectural rules and non-obvious constraints for this repository.

## Networking

### Upstream API access goes through the main process

Why:

- avoids renderer CORS problems
- keeps cookies and normalization logic in one place

Rule:

- renderer code must use `window.api` and `TouchGalClient`

### Main-process auth token normalization owns header safety

Rule:

- sanitize and normalize persisted auth token input before using it in upstream headers
- build upstream auth cookies in the main process instead of concatenating raw renderer/user-provided strings
- do not send a `Cookie` header at all when there is no valid auth cookie to send
- renderer logout must call back into the main process so the persisted token is actually cleared

Reason:

- prevents invalid header content from poisoning upstream browse/search requests
- keeps legacy token formats and migrated disk state from breaking the app on startup
- avoids renderer-only logout that leaves upstream requests authenticated

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

### Stage ownership is fixed

- Stage 1 fields belong upstream
- Stage 2 fields belong to local pure predicates
- Stage 3 belongs to detail enrichment and strict tag matching

Do not re-apply Stage 1 fields inside the local predicate.

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

Reason:

- these three fields are upstream API inputs, not local advanced-processing inputs
- separating them from the advanced panel makes the browse model easier to understand and reduces unnecessary advanced-mode mental overhead

### Detail data must be resolved from the final patch id

Rule:

- detail comments and ratings must be fetched only after the resolved detail payload is available, using the final patch id from that payload
- do not rely solely on the homepage card id when loading detail-side discussion or evaluation data
- stale detail responses must be ignored if the user has already opened another resource

Reason:

- homepage cards may not always carry the final id needed by comment/rating endpoints
- without request guarding, slower earlier detail requests can overwrite the currently open game

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

Reason:

- keeps detail presentation changes localized
- avoids mixing tab UI, session gating, and content-specific markup in one large component

### Advanced tag state has one source of truth

Rule:

- advanced tag constraints are owned by `advancedFilterDraft.selectedTags`
- do not maintain a second standalone renderer tag list for the same filters

Reason:

- prevents tag-chip UI, filter bar UI, and advanced-mode predicate logic from drifting apart

### Exiting advanced search must clear constraints and refresh normal browse

Rule:

- the advanced-mode exit action must clear advanced constraints, reset advanced-mode UI state, and trigger a normal homepage refresh
- preserving sort field and sort order is allowed; preserving advanced constraints is not

Reason:

- users expect “退出高级模式” to return to ordinary browsing immediately, not only flip an internal mode flag

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
