# Homepage Advanced Filter Project Brief

## Goal

Build a homepage advanced-filter module that does **not** call `/search`.

The module must provide correct multi-condition filtering on top of TouchGal homepage resources, even if that requires a slower entry flow into advanced mode.

## Hard Constraints

1. Homepage advanced filtering must never call `POST /api/search`.
2. Normal homepage browsing keeps the current incremental server-paginated flow.
3. Advanced filtering is a separate mode entered explicitly by the user.
4. Correctness is more important than initial performance.
5. Partial enrichment failures are allowed, but failed cards must be visibly reported in development.

## User Model

### Normal Mode

- Uses the existing server-paginated homepage flow.
- Keeps progressive browsing behavior.
- Does not build a full local filter index.

### Advanced Filter Mode

- Entered only when the user confirms advanced filtering with `Enter`.
- Switches the homepage into a blocking "build full dataset" workflow.
- Builds a full local filtering dataset for the current content domain.
- After the dataset is ready, filtering and pagination happen locally.

## Content Domain Rules

- `SFW`, `NSFW`, and `ALL` are treated as separate datasets.
- Homepage defaults to `SFW`.
- Entering advanced mode initially builds the `SFW` dataset.
- If the user later switches to `NSFW` or `ALL`, a separate full build starts for that domain.
- Cached datasets and indexes for `SFW`, `NSFW`, and `ALL` must never overwrite each other.

## Supported Advanced Filters

The final advanced mode supports local filtering for:

- Platform
- Year
- Minimum rating count
- Minimum average rating
- Minimum discussion count
- Tags

Conditions are combined with `AND`.

### Tag Semantics

Multi-tag filtering uses set containment:

- Let `selectedTags` be the user-selected tag set
- Let `gameTags` be the full tag set for a game
- A game matches iff `selectedTags` is a subset of `gameTags`

In other words:

- one selected tag: the game must contain that tag
- many selected tags: the game must contain every selected tag

## Why `/search` Is Forbidden Here

`/search` is not acceptable for homepage advanced filtering because:

- the homepage module must remain independent from keyword-search semantics
- tag search on the upstream web app only supports limited server-side tag browsing
- we need multi-tag set filtering, which must be done locally for correctness

## Data Sources

### Base Dataset

Source:

- `GET /api/galgame`

Used for:

- card identity
- banner
- platform
- created/released-derived year
- rating summary fields already present on cards
- discussion count already present on cards
- pagination total

Important limitation:

- homepage `/galgame` cards expose only a truncated tag preview, not the full tag set

### Full Tag Enrichment

Source:

- `GET /api/patch/introduction?uniqueId=...`

Used for:

- full tag set per game
- more accurate release information when available

### Tag Option Source

Source:

- `GET /api/tag/all?page=...&limit=...`

Used for:

- complete tag list for tag picker suggestions

This endpoint provides available tags, but not enough to replace local multi-tag filtering.

## Build Pipeline for Advanced Mode

Advanced mode uses a two-stage local index build.

### Stage A: Full Homepage Harvest

For the current content domain:

1. Request the first `/api/galgame` page
2. Read `total`
3. Compute total page count
4. Fetch all remaining pages
5. Merge them into one complete in-memory dataset

### Stage B: Tag Enrichment

For every harvested game:

1. Request `/api/patch/introduction` by `uniqueId`
2. Extract the full tag set
3. Store `uniqueId -> fullTags[]`
4. Optionally store normalized release information from introduction data

### Stage C: Local Filtering

After Stage A and Stage B finish:

1. Build the local advanced dataset
2. Apply local filter predicates
3. Render filtered results with local pagination

## Concurrency Model

Use structured concurrency for both Stage A and Stage B.

Requirements:

- Every advanced-mode build belongs to one build session
- A build session has a unique id
- Session state is isolated by content domain
- Late results from stale sessions must be discarded
- Switching out of advanced mode or changing content domain must cancel or invalidate the old session

Implementation guidance:

- use bounded parallelism for page fetches and introduction enrichment
- group child tasks under the current build session
- only commit session results if the session is still current

Performance tuning is not the current priority, but unbounded fan-out is still forbidden.

## Failure Strategy

Partial failures are allowed.

Rules:

- If a card fails enrichment, that card is excluded from tag-correct advanced results
- Failed cards are tracked explicitly
- In development, failures must be visible in UI or logs
- The system should continue building the rest of the dataset

This means:

- advanced mode aims for maximum completeness
- but does not fail the entire build because a minority of cards fail enrichment

## UI Behavior

### Entering Advanced Mode

- User adjusts advanced filter inputs
- User presses `Enter`
- Homepage switches to advanced build mode
- Results area may block while the full dataset is being built

### During Build

- Show explicit loading state
- Show progress if available
- Do not mix normal server-paginated browsing with advanced-mode local paging

### After Build

- Render fully local filtered results
- Pagination is local pagination on the built dataset

### Exiting Advanced Mode

- Return to normal homepage mode
- Reuse cached advanced datasets when valid
- Do not let advanced-mode state mutate the normal mode result list accidentally

## State Separation Requirements

The implementation must separate:

- normal homepage query state
- advanced filter draft state
- advanced build session state
- advanced cached dataset state
- advanced filtered result state

At minimum, keep separate state for:

- `mode: normal | advanced_building | advanced_ready`
- `contentDomain: sfw | nsfw | all`
- `buildSessionId`
- `buildProgress`
- `advancedDatasetsByDomain`
- `enrichmentFailuresByDomain`

## Out of Scope for This Slice

- upstream API redesign
- homepage keyword search redesign
- optimizing build latency before correctness is achieved
- replacing `/api/patch/introduction` with a custom batch endpoint

## Implementation Phases

### Phase 1

- add advanced-mode state model
- separate normal mode and advanced mode result pipelines
- add build session lifecycle

### Phase 2

- implement full `/api/galgame` harvest
- implement local dataset aggregation
- implement development-visible build progress

### Phase 3

- implement `/api/patch/introduction` enrichment
- store full tag sets and enrichment failures

### Phase 4

- implement local filter predicates
- implement local pagination
- connect advanced filter UI to advanced mode execution

### Phase 5

- cache by content domain
- add invalidation and rebuild paths
- add guardrails against stale-session commits

## Acceptance Criteria

- Homepage advanced filtering never hits `/search`
- Advanced mode can build a full local dataset for `SFW`
- Switching to `NSFW` or `ALL` builds a separate dataset
- Multi-tag filtering uses subset semantics correctly
- Platform, year, rating count, average rating, and discussion count filter locally
- Normal homepage mode remains intact
- Partial enrichment failures are visible in development and do not crash the whole build
