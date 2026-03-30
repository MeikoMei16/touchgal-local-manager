# Decisions

Stable architectural rules and non-obvious constraints for this repository.

## Networking

### Upstream API access goes through the main process

Why:

- avoids renderer CORS problems
- keeps cookies and normalization logic in one place

Rule:

- renderer code must use `window.api` and `TouchGalClient`

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

### Homepage query state is store-owned

Rule:

- homepage sorting and upstream browse query fields belong to store state, not component-local state
- `lastHomeQuery` is the canonical homepage query object
- homepage persistence for query/page restore uses renderer `localStorage`

Reason:

- avoids split-brain state between React local state and persisted browse state
- keeps normal-mode fetches and advanced-mode transitions consistent

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
