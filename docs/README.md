# Documentation Index

This repository keeps project documentation under `docs/` and lightweight agent guidance under `.agents/`.

## Core Docs

- `architecture.md`: Current application architecture, runtime boundaries, and implementation status.
- `advanced-filter.md`: Homepage advanced-filter pipeline, query model, and advanced-mode behavior.
- `decisions.md`: Stable architectural decisions and non-obvious frontend/runtime constraints.
- `styling.md`: Renderer UI tokens and styling conventions.

Current cross-cutting topics covered here:

- homepage query ownership, persistence, and hydration
- advanced search pipeline, cache reuse, and exit behavior
- main-process auth token normalization and upstream header/cookie rules
- current login and captcha interaction constraints

## API Notes

- `api/user_profile.md`: Notes for user-profile related upstream endpoints.

## Agent Docs

- `.agents/knowledge.md`: Short project facts for future agents.
- `.agents/workflows/`: Recovery workflows for Electron environment issues.
