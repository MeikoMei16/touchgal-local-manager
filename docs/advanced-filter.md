# Advanced Filter

This document describes the current homepage advanced-filter design in this repository.

## Goal

Provide correct multi-condition filtering for homepage resources while treating tags as strict filters, not fuzzy search terms, and provide stable rating sorting when upstream rating pagination is unreliable.

## Core Rule

Do not use `/search` as the source of truth for homepage tag filtering.

Reason:

- tag search semantics are retrieval-oriented
- homepage advanced filtering needs strict boolean filtering
- selected tags must compose with all other advanced conditions using `AND`

## Pipeline

### Stage 1: Upstream coarse filtering

Source:

- `GET /galgame`

Fields sent upstream:

- `nsfwMode`
- `selectedPlatform`
- `minRatingCount`

Purpose:

- reduce candidate set size before local processing
- these upstream controls are exposed directly on the homepage top bar, to the left of the `高级筛选` button
- `minRatingCount` remains a normal-mode-safe upstream `/galgame` filter by itself; it does not force the renderer into advanced mode

### Stage 2: Midstream local filtering

Applied in memory to each fetched page:

- `yearConstraints`
- `minRatingScore`
- `minCommentCount`

Properties:

- `minRatingScore` and `minCommentCount` are pure predicates
- `yearConstraints` are evaluated locally, but correct release-year filtering may require Stage 3 release-date hydration first when upstream list data omits `releasedDate`

Release-year rule:

- release-year filtering must use release date only
- do not treat resource `created` time as release date
- if the candidate list does not already carry `releasedDate`, advanced mode must hydrate `/patch/introduction` and re-compute `normalizedYear` from `intro.releasedDate` before applying `yearConstraints`

### Stage 3: Downstream tag enrichment

Triggered when either of these is true:

- `selectedTags.length > 0`
- `yearConstraints.length > 0`

Source:

- `getPatchIntroduction(uniqueId)`

Purpose:

- obtain full tags
- obtain authoritative release date when homepage list data omits it
- optionally improve release-date normalization

Final tag rule:

```ts
selectedTags.every((tag) => fullTags.has(tag))
```

That means selected tags are combined with set-containment semantics:

- one tag: resource must contain that tag
- many tags: resource must contain all selected tags

## Rating Sort Rule

`sortField === 'rating'` is treated as an advanced-mode trigger.

Reason:

- upstream rating pagination is not stable enough to trust page-by-page ordering
- the renderer already has a local-catalog pipeline with bounded concurrency, stale-session cancellation, and local pagination
- there is no separate rating-only mode; rating sort reuses the same advanced dataset and progress UI

## Store Model

This is now split across dedicated renderer store modules:

- [`src/renderer/src/store/uiStore.ts`](../src/renderer/src/store/uiStore.ts): UI-store assembly and persistence config
- [`src/renderer/src/store/uiActions/browseActions.ts`](../src/renderer/src/store/uiActions/browseActions.ts): normal browse actions
- [`src/renderer/src/store/uiActions/advancedActions.ts`](../src/renderer/src/store/uiActions/advancedActions.ts): advanced pipeline actions
- [`src/renderer/src/store/uiStoreTypes.ts`](../src/renderer/src/store/uiStoreTypes.ts): shared UI-store boundary types

Compatibility note:

- [`src/renderer/src/store/useTouchGalStore.ts`](../src/renderer/src/store/useTouchGalStore.ts) is no longer the implementation source of truth
- it remains as a compatibility bridge that re-exports the split stores for older imports
- new frontend state work should target `uiStore.ts` / `authStore.ts` and the action modules directly

Key state:

- `lastHomeQuery`
- `homeMode`
- `activeNsfwDomain`
- `advancedFilterDraft`
- `advancedBuildSessionId`
- `advancedBuildProgress`
- `advancedDatasetsByDomain`

Query model:

- `lastHomeQuery` is the canonical homepage query state
- normal-mode fetches derive their upstream request from that query
- `sortField` and `sortOrder` are part of the store query, not component-local state
- `sortField === 'rating'` causes the controller to enter advanced mode so sorting happens locally against the built candidate catalog
- homepage query state and current page are persisted in renderer `localStorage`
- hydration must complete before normal-mode homepage fetch effects run
- normal homepage refresh is expected to restore sort key, sort order, upstream filters, and current page
- `nsfwMode`, `selectedPlatform`, and `minRatingCount` are edited from homepage chrome instead of the advanced panel
- `minRatingCount` participates in advanced dataset cache keys when advanced mode is already active, but changing it alone should still stay on normal upstream pagination
- homepage query control logic is no longer embedded in `Home.tsx`; it lives in `features/home/homeQuery.ts` and `features/home/useHomeQueryController.ts`

Draft model:

- `advancedFilterDraft` is the editable advanced-search draft
- `advancedFilterDraft.selectedTags` is the single source of truth for advanced tag constraints
- `selectedTags` are also mirrored into `lastHomeQuery` when the homepage query is committed
- editing inputs in the advanced panel updates draft/query state immediately, but the expensive advanced build is launched only by the `应用筛选` button

Modes:

- `normal`
- `advanced_building`
- `advanced_ready`

## Session Rules

- Every advanced build gets a unique session id.
- Late results from stale sessions are ignored.
- Datasets are isolated by domain.
- Rating sort and advanced filters share the same build session, cache, and local pagination path.
- Exiting advanced mode returns homepage behavior to normal API pagination.
- Clearing advanced search resets advanced constraints while preserving the current top-level sort order.
- Clearing advanced search preserves Stage 1 upstream controls such as `nsfwMode`, `selectedPlatform`, and `minRatingCount`.
- If the current sort field is `rating`, the exit action rewrites it to `created` so the homepage does not immediately re-enter the advanced local-catalog path.
- Clearing advanced search currently resets the homepage page index back to `1`.
- Persisted homepage query state auto-enters advanced mode on mount whenever the restored query still requires local handling, including `sortField === 'rating'`.

## Current Behavior Notes

- Candidate pages are fetched with bounded concurrency.
- Tag enrichment also uses bounded concurrency.
- During Stage 3, strict tag filtering hides un-hydrated resources until they are enriched.
- During Stage 3, release-year filtering also waits for hydrated release dates when the upstream list omitted `releasedDate`.
- Local sorting and pagination happen after predicate application in advanced mode.
- Rating sort is applied locally against the advanced dataset rather than delegated to unstable upstream page ordering.
- When coarse upstream inputs (`nsfwMode`, `selectedPlatform`, `minRatingCount`) stay the same, switching between rating sort and other advanced constraints reuses the same candidate catalog.
- Advanced-mode pagination is clamped locally after filtering so page indices stay valid when result counts shrink.
- Tag enrichment failures are tracked and surfaced in the advanced-mode status UI; failed candidates are excluded from strict tag results.
- Catalog-page fetch failures are surfaced in both console logs and the advanced-mode status UI so users can see which build step failed.
- The advanced-mode exit button clears advanced constraints; if the current sort is `rating`, the exit action rewrites it to `created` before returning to normal mode.
- Exiting advanced mode clears only Stage 2 / Stage 3 constraints; Stage 1 upstream controls remain in `lastHomeQuery` and continue to drive normal `/galgame` pagination.
- Normal-mode page navigation updates persisted page state first; the resulting fetch is driven by the homepage effect, not by direct button-triggered fetch calls.
- Normal-mode sort changes keep the current page instead of forcing a page reset.
- Pressing `Enter` inside the release-year input only records the constraint chip; it must not launch the advanced build.
- Homepage top bar now splits responsibilities clearly:
  upstream controls live in chrome
  the advanced panel owns only midstream and downstream constraints
- advanced-mode implementation is now modularized:
  browse actions, detail actions, and advanced actions are separate modules under `src/renderer/src/store/uiActions/`

## Caching

Advanced datasets are cached by upstream coarse-filter key:

- content domain
- selected platform
- minimum rating count

When those upstream inputs do not change, the renderer can reuse the existing candidate catalog and only continue any missing tag enrichment work.

The same cache is reused for rating sort because rating sort is not a separate mode; it is just another advanced-mode view over the same candidate dataset.
