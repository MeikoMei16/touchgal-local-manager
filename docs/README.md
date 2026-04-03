# Documentation Index

This repository keeps project documentation under `docs/` and lightweight agent guidance under `.agents/`.

## Core Docs

- `architecture.md`: Current application architecture, runtime boundaries, and implementation status.
- `advanced-filter.md`: Homepage advanced-filter pipeline, query model, and advanced-mode behavior.
- `decisions.md`: Stable architectural decisions and non-obvious frontend/runtime constraints.
- `styling.md`: Renderer UI tokens and styling conventions.

Current cross-cutting topics covered here:

- app-level left-nav persistence and refresh restore
- renderer store split and compatibility-bridge status
- homepage query ownership, persistence, and hydration
- dedicated search-page semantics, scope toggles, and upstream sort controls
- advanced search and rating-sort pipeline, cache reuse, and current exit behavior
- known limits of upstream rating data completeness even after local rating-sort stabilization
- homepage top-bar upstream filters versus advanced-panel midstream/downstream filters
- main-process auth token normalization and upstream header/cookie rules
- current login and captcha interaction constraints
- renderer settings page and persisted interaction preferences
- guarded detail loading and current detail-overlay composition rules
- detail secondary-click behavior with default right-click-to-back handling
- detail media extraction from introduction HTML and sectioned resource-link presentation via `/patch/resource`

## API Notes

- `api/user_profile.md`: Notes for user-profile related upstream endpoints.

## Agent Docs

- `.agents/knowledge.md`: Short project facts for future agents.
- `.agents/workflows/`: Recovery workflows for Electron environment issues.
