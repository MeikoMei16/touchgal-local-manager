# Advanced Filter

This document describes the current homepage advanced-filter design in this repository.

## Goal

Provide correct multi-condition filtering for homepage resources while treating tags as strict filters, not fuzzy search terms.

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

### Stage 2: Midstream local filtering

Applied in memory to each fetched page:

- `yearConstraints`
- `minRatingScore`
- `minCommentCount`

Properties:

- pure predicate
- no async work
- no network IO

### Stage 3: Downstream tag enrichment

Triggered only when `selectedTags.length > 0`.

Source:

- `getPatchIntroduction(uniqueId)`

Purpose:

- obtain full tags
- optionally improve release-date normalization

Final tag rule:

```ts
selectedTags.every((tag) => fullTags.has(tag))
```

That means selected tags are combined with set-containment semantics:

- one tag: resource must contain that tag
- many tags: resource must contain all selected tags

## Store Model

The main implementation lives in [`src/renderer/src/store/useTouchGalStore.ts`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/store/useTouchGalStore.ts).

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
- homepage query state and current page are persisted in renderer `localStorage`
- hydration must complete before normal-mode homepage fetch effects run
- normal homepage refresh is expected to restore sort key, sort order, upstream filters, and current page

Draft model:

- `advancedFilterDraft` is the editable advanced-search draft
- `advancedFilterDraft.selectedTags` is the single source of truth for advanced tag constraints
- `selectedTags` are also mirrored into `lastHomeQuery` when the homepage query is committed

Modes:

- `normal`
- `advanced_building`
- `advanced_ready`

## Session Rules

- Every advanced build gets a unique session id.
- Late results from stale sessions are ignored.
- Datasets are isolated by domain.
- Exiting advanced mode returns homepage behavior to normal API pagination.
- Clearing advanced search resets advanced constraints while preserving the current top-level sort field and sort order.
- Clearing advanced search currently resets the homepage page index back to `1`.
- Persisted homepage query state does not auto-enter advanced mode on mount; normal browse remains the default until the user explicitly submits advanced mode again.

## Current Behavior Notes

- Candidate pages are fetched with bounded concurrency.
- Tag enrichment also uses bounded concurrency.
- During Stage 3, strict tag filtering hides un-hydrated resources until they are enriched.
- Local sorting and pagination happen after predicate application in advanced mode.
- Advanced-mode pagination is clamped locally after filtering so page indices stay valid when result counts shrink.
- Tag enrichment failures are tracked and surfaced in the advanced-mode status UI; failed candidates are excluded from strict tag results.
- The advanced-mode exit button is expected to clear advanced constraints and immediately refresh the homepage back into normal browse mode.
- Normal-mode page navigation updates persisted page state first; the resulting fetch is driven by the homepage effect, not by direct button-triggered fetch calls.
- Normal-mode sort changes keep the current page instead of forcing a page reset.

## Caching

Advanced datasets are cached by upstream coarse-filter key:

- content domain
- selected platform
- minimum rating count

When those upstream inputs do not change, the renderer can reuse the existing candidate catalog and only continue any missing tag enrichment work.
