# Library Resource Pipeline Status

Status snapshot for the current local-library pipeline. This document is intentionally separate from the main architecture docs because the download -> extract -> library flow is currently the most unstable and highest-risk part of the app.

## Scope

This document covers:

- official-resource download routing into the in-app queue
- raw archive placement under `download/`
- post-download extraction into `library/`
- local game linking and library-card generation
- current failures around game-container hierarchy
- required strategy for nested archives such as `.rar` inside extracted folders

It does not try to define the final UI. It documents the current behavior, the observed problems, and the next technical target.

## Current Defaults

- raw downloads go to project-root `download/`
- extracted output goes to project-root `library/`
- `library/` is also the default watched library root
- extractor preference order is `Bandizip -> 7-Zip`
- current password probe set is `""` then `touchgal`
- nested archive auto-extraction depth is user-configurable in Settings and defaults to `3`
- recursive extraction failures are surfaced back into the download task warning state and exposed to the renderer as visible warnings/toasts

## Current Pipeline

### 1. Resource enqueue

TouchGal official resources from quick download and from the detail overlay are queued into the local downloader.

Community resources are still treated as external links and do not enter the local queue.

### 2. Source resolution

The downloader currently resolves sources based on the upstream share shape:

- direct file URL -> one output file
- Cloudreve single-file share -> one output file in `download/`
- Cloudreve directory share -> recursive walk under `download/<share-name>/...`

This means the current raw-download layout is not controlled by the app alone. It partially mirrors the upstream Cloudreve share type.

### 3. Extraction

After a queued file finishes downloading:

- if it is a supported archive extension
- and it is the first part or a single archive
- the app probes password support
- then extracts into `library/`

The extraction target name is currently derived from the matched TouchGal game name when `gameId` exists.

### 4. Local linking

After extraction succeeds:

- a `.tg_id` marker may be written
- the extracted folder is linked into local SQLite via `local_paths`
- Library UI then treats that extracted path as a local game entry
- opening a local game directory from Library also updates `last_opened_at` on that local entry so the game wall can sort by recent-opened

### 5. Library front-stage behavior

The current front-stage Library view is intentionally narrower than the heavy management popup/window:

- game cards are compact and content-first
- search matches only local title + alias
- sort options are currently only `recently added` and `recently opened`
- `recently opened` is defined by explicit open-folder actions, not by card focus or selection

## Confirmed Current Problems

### Problem 1: raw download layout is inconsistent

The app currently creates `download/<game-name>/...` only when the upstream source is a Cloudreve directory share.

If the upstream source is a single-file share, the archive lands directly in top-level `download/`.

Result:

- same game
- same user action
- different raw disk layout

This is not predictable from the UI and leaks upstream storage shape into local product behavior.

### Problem 2: one archive currently becomes one top-level local game entity

This is the main architectural bug.

Right now the pipeline implicitly treats these as the same thing:

- a downloaded resource archive
- an extracted folder
- a local game entity shown in Library

That assumption is wrong for games that have:

- base game
- FD / side content
- patches
- crack packages
- translation packs
- extra assets

These are separate resources that belong to one game, not separate games.

### Problem 3: top-level duplicate game folders are being created

When multiple resources for the same game are extracted, the current collision handling creates sibling folders such as:

- `Game Name`
- `Game Name (2)`
- `Game Name (3)`
- `Game Name (4)`

This prevents the library from forming a single canonical game container.

It also causes the UI to generate multiple visually duplicated game cards for what is actually one game with several local resources.

### Problem 4: Library UI hierarchy is corrupted by the filesystem model

Because each extracted archive becomes an independent linked path, Library currently surfaces duplicate top-level local entries.

This is why the local game management view becomes visually wrong even if the card layout itself is acceptable. The data model under the UI is already fragmented.

### Problem 5: extraction is currently only first-layer

Observed library contents already show nested archives surviving inside extracted folders, for example:

- inner `DL版 (files).rar`
- patch `.zip`
- patch `.7z`
- `Crack.rar`

So the app is often extracting only the first wrapper archive while the actual useful payload is still packed one level deeper.

### Problem 6: resource identity and fallback classification are not persisted cleanly enough

At the moment the system does not maintain a stable local resource model that preserves:

- original archive file name
- source URL
- resolved output path
- extracted path
- inferred resource bucket when available
- relationship to parent game container

Without that metadata, it is hard to:

- recover from a bad guess
- preserve a useful fallback bucket for UI grouping
- rebuild hierarchy later
- explain to the UI what should be grouped together

## Observed Example

For `光翼战姬 Extia 3`, the current library state showed:

- one extracted base-game folder containing the actual executable
- several sibling folders such as `光翼战姬 Extia 3 (2)`, `(3)`, `(4)`, `(5)`
- those sibling folders contained nested archives and patch-like assets instead of becoming child resources of the same game

This confirms that the current model is archive-centric, not game-centric.

## Required Target Model

The next stable model should be:

- one canonical local game container per TouchGal game
- multiple resource entries under that game
- resource entries should preserve original resource identity first, with lightweight bucketed grouping when confidence is acceptable
- Library UI should render one game card and then manage its child resources

In other words:

- one game != one archive
- one game != one extracted folder

The correct relationship is:

- one game
- many local resources

The current UI direction is:

- keep the front-stage wall lightweight
- push heavier local-management logic into the popup/window layer
- preserve a TODO to restore launcher / multi-executable selection in a less noisy management surface instead of overloading the front-stage card

## Proposed Filesystem Direction

### Raw downloads

When a TouchGal resource is associated with a known game, raw downloads should converge under one game folder:

```text
download/<game-name>/...
```

Do not rely on Cloudreve `is_dir` to decide whether a game-name folder exists.

If upstream is a directory share, preserve its relative structure under that game folder.

If upstream is a single-file share, place the file under that same game folder.

### Extracted library

The extracted library should converge under one canonical game container:

```text
library/<game-name>/
```

Inside that container, child resource directories should be created instead of new top-level sibling game folders.

A conservative first step is:

```text
library/<game-name>/base/<resource-name>/
library/<game-name>/fd/<resource-name>/
library/<game-name>/patch/<resource-name>/
library/<game-name>/resources/<resource-name>/
```

Where `<resource-name>` should come from the original archive or original upstream resource name as much as possible.

This is a hybrid fallback model:

- if the app has a strong enough heuristic signal, use a semantic bucket such as `base`, `fd`, or `patch`
- otherwise fall back to the neutral `resources/` bucket

The exact child taxonomy can evolve later if the app ever gains trustworthy manual labeling or stronger signals. The important rule for now is that the top-level game container stays unique.

## Resource Metadata That Must Be Persisted

For each downloaded local resource, the app should preserve at least:

- `game_id`
- original archive file name
- source URL
- raw archive path
- extracted path
- inferred bucket when one is assigned
- parent resource id when created by recursive extraction

The original archive file name is especially important. Even with fallback bucketing, the raw file name remains the best recovery signal for later regrouping or manual correction.

## Nested Archive Strategy

Nested archives are not optional edge cases. They are already present in the current `library/` contents.

The pipeline needs controlled recursive extraction.

### Required behavior

After extracting a resource:

1. scan the extracted output for supported nested archives
2. if nested archives are found, register them as child resources
3. optionally extract them into child resource directories
4. repeat up to a bounded depth

### Constraints

- recursion must be bounded
- recursion must avoid duplicate reprocessing
- recursion must not loop forever on malformed archive layouts
- extraction support must still respect actual extractor capability per extension

### Practical initial limit

A safe initial strategy is:

- maximum depth is configurable in Settings and currently defaults to `3`
- only recurse for supported extensions
- only recurse when the nested archive is inside the current resource output
- record a parent-child chain for traceability

## Hybrid Fallback Strategy

The current direction is a hybrid fallback model rather than a pure semantic model or a pure flat resource-name model.

Instead:

- preserve the original resource name
- use that original resource name as the child directory label under the assigned bucket
- use semantic buckets only when the heuristic signal is strong enough
- fall back to `resources/` when the app cannot confidently infer `base`, `fd`, or `patch`

If later versions add manual labeling or stronger heuristics, that should be layered on top of preserved original names instead of replacing them.

## Current Extractor Reality

Extractor support depends on the actual installed CLI.

Important confirmed behavior:

- Bandizip is preferred when available
- 7-Zip support is extension-sensitive
- on this Linux machine, installed `7z` did not support `.rar`
- a failure to open some `.rar` files was therefore not a password problem but a format-support problem

This means recursive extraction must use the same per-extension extractor selection logic already added for first-layer extraction.

## Immediate Next Technical Goals

The next implementation pass should prioritize:

1. unify raw downloads under `download/<game-name>/`
2. stop creating top-level `library/Game Name (2)` style siblings for the same game
3. introduce a local resource model distinct from `local_paths`
4. persist original archive file names plus fallback bucket metadata
5. add bounded recursive nested-archive discovery and extraction
6. update Library data flow so one game card owns multiple local resources

## Non-Goals For The First Fix

The first repair pass does not need to solve all of these:

- perfect FD recognition
- perfect patch recognition
- final polished management UI
- automatic launcher selection across all child resources

The first fix must only establish a correct data and filesystem model so the UI stops fragmenting one game into many fake local games.

## Summary

The local-library pipeline currently works well enough to:

- queue official downloads
- save archives locally
- extract some archives automatically
- detect playable outputs in simple cases

But it is not yet modeling the real relationship between games and resources.

The central correction is:

- one game container
- many child resources

Until that is true in both filesystem layout and SQLite metadata, the Library management UI will continue to look broken even if its visual components are redesigned.
