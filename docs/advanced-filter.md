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

- `homeMode`
- `activeNsfwDomain`
- `advancedFilterDraft`
- `advancedBuildSessionId`
- `advancedBuildProgress`
- `advancedDatasetsByDomain`

Modes:

- `normal`
- `advanced_building`
- `advanced_ready`

## Session Rules

- Every advanced build gets a unique session id.
- Late results from stale sessions are ignored.
- Datasets are isolated by domain.
- Exiting advanced mode returns homepage behavior to normal API pagination.

## Current Behavior Notes

- Candidate pages are fetched with bounded concurrency.
- Tag enrichment also uses bounded concurrency.
- During Stage 3, un-hydrated resources remain visible until enrichment resolves.
- Local sorting and pagination happen after predicate application in advanced mode.

## Known Mismatch To Watch

The main-process relay still contains an older branch that switches to `/search` when `selectedTags` are present. The advanced-mode pipeline already avoids depending on that branch, but the relay should eventually be aligned with the documented architecture.
