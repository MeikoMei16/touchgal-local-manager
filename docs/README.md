# Documentation Index

This repository keeps project documentation under `docs/` and lightweight agent guidance under `.agents/`.

## Core Docs

- `architecture.md`: Current application architecture, runtime boundaries, and implementation status.
- `advanced-filter.md`: Homepage advanced-filter pipeline, query model, and advanced-mode behavior.
- `decisions.md`: Stable architectural decisions and non-obvious frontend/runtime constraints.
- `library-resource-pipeline-status.md`: Current status, confirmed problems, and next target model for the local download -> extract -> library pipeline.
- `styling.md`: Renderer UI tokens and styling conventions.

Current cross-cutting topics covered here:

- app-level left-nav persistence and refresh restore
- homepage card interaction and current visual behavior
- homepage feed-tag limits versus detail/introduction tag enrichment
- homepage and search pagination scroll-to-top behavior
- Search-page NSFW domain controls and dedicated search-state ownership
- detail resource metadata normalization and deduplicated chip presentation
- renderer store split and compatibility-bridge status
- homepage query ownership, persistence, and hydration
- dedicated search-page semantics, scope toggles, and upstream sort controls
- advanced search and rating-sort pipeline, cache reuse, and current exit behavior
- known limits of upstream rating data completeness even after local rating-sort stabilization
- homepage top-bar upstream filters versus advanced-panel midstream/downstream filters
- homepage hover-side `收藏` action now opens a floating quick-collect panel directly on the browse grid
- main-process auth token normalization and upstream header/cookie rules
- startup session revalidation and the distinction between renderer auth UI state and real main-process session state
- persisted upstream auth cookies in addition to the normalized token, plus stale-auth cleanup after failed restore
- parallel local-collection and cloud-favorites architecture for the Favorites area
- SQLite-backed local collection CRUD plus detail-header integration for adding/removing a game locally
- local collection overlay gallery UX with inline move/copy/remove and batch organization actions
- Favorites-page header layout for domain-local creation controls
- Favorites-page shared delete-confirmation flow and card-level delete actions
- cloud favorite folder content loading via the upstream `/user/profile/favorite/folder/patch` API
- cloud favorite folder mutation through upstream `/patch/favorite` toggle semantics
- cloud favorite folder create/delete lifecycle through the upstream folder endpoints
- cloud overlay batch move/remove behavior and current count-refresh rules
- detail-overlay favorite menu now queries cloud folders with `patchId` and supports per-folder add/remove toggle behavior that matches the upstream site
- current login and captcha interaction constraints
- startup auth/session restore hardening, including persisted cookie restore and stale-auth cleanup
- profile-shell and profile-tab loading states
- detail discussion/evaluation session gating and post-login social refresh behavior
- renderer settings page and persisted interaction preferences
- renderer settings page and persisted download-directory selection
- renderer settings page now also covers Library popup-vs-window management mode plus separate maintenance actions for database reset and cache clearing
- guarded detail loading and current detail-overlay composition rules
- detail secondary-click behavior with default right-click-to-back handling
- layer-aware `Escape` handling for detail overlay and full-screen screenshot viewer
- collection-overlay to detail-overlay stacking order rules
- invalid nested-button avoidance in Favorites folder cards
- detail media extraction from introduction HTML and sectioned resource-link presentation via `/patch/resource`
- detail links panel official resources now queue in-app downloads while community resources keep the external-link flow
- homepage quick-collect panel keeps card clipping intact while allowing the panel itself to float across the grid and auto-flip left/right by viewport position
- homepage quick-download panel limited to TouchGal official game resources
- collection-card quick-download buttons and body-level floating download panels
- persisted download queue, concurrent worker behavior, resume/retry/delete semantics, bulk selection, and the dedicated Downloads page
- quick-download entries now surface the same normalized metadata chips used by the detail links view instead of a size-only compact line
- shared quick-download popovers now use a wider panel layout so full metadata chips and long titles fit without collapsing
- local Library manager default `library/` watch-root seeding, library-first layout, rescan flow, linked-install inventory, direct open-in-folder and local launch actions, and grouped unresolved/orphaned/broken reporting
- compact Library front-stage cards that search only against local game title + alias, sort by recent-added or recent-opened, and treat open-folder as the "recently opened" signal
- pushed download-queue updates, extractor-status settings, and SQLite-backed download concurrency settings
- recursive nested-archive extraction with Settings-backed depth control and Downloads warning/toast surfacing when inner archive extraction fails
- Settings maintenance now splits destructive cleanup into two confirmed actions: reset SQLite database versus clear runtime/session cache
- post-download extraction into project-root `library/` while archives remain under `download/`, including collision-safe target naming
- the current failure mode of the local library resource pipeline, including why one game is still being fragmented into multiple extracted sibling folders and what the target single-container model should be
- bounded-recursive library scanning (up to 3 levels) with explicit candidate classification instead of one-level folder discovery
- extractor fallback order (`Bandizip -> 7-Zip`) and the current password probe set (`""`, `touchgal`)
- batch deletion of download files is constrained to paths inside the current download root and deliberately excludes `library/` extraction outputs

## API Notes

- `api/user_profile.md`: Notes for user-profile related upstream endpoints.

## Agent Docs

- `.agents/knowledge.md`: Short project facts for future agents.
- `.agents/workflows/`: Recovery workflows for Electron environment issues.
