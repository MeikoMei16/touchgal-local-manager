[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![中文](https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-lightgrey?style=for-the-badge)](./README.zh-CN.md)

# TouchGal Local Manager

Electron desktop client for browsing TouchGal resources with a local-state-heavy UX, advanced homepage filtering, and room for future local-first features.

## Current Focus

- upstream API relay through Electron main process
- normalized session/token handling in the main-process relay
- React renderer with Zustand state
- persisted app-level left-nav restore across refresh
- persisted homepage browse state with hydration-aware refresh restore
- advanced homepage filtering and rating sorting with a local catalog pipeline, including release-date hydration for correct release-year filtering
- dedicated search page for keyword-oriented fuzzy search with toggleable scope options and upstream sorting
- dedicated search page NSFW domain toggle wired through the main-process search relay
- local search-page `rating` sort rebuilt from stable search candidates with visible in-page progress and incremental rendering
- checkpoint-based advanced-build resume with page/resource progress retention
- homepage resource cards with compact 3-tag chips, inline stat icons, hover-revealed right-edge action tabs, and page-change scroll reset
- detail overlay for introduction, extracted screenshots/PV media, sectioned resource links, ratings, comments, session-aware gating, configurable right-click back behavior, and `Esc`-to-close support
- full-screen screenshot viewer with previous/next navigation and keyboard arrow support
- detail resource metadata chips normalized to field-aware Chinese labels with duplicate labels removed
- detail resource type chips normalized against upstream enum drift such as `row` rendering as `生肉资源`
- startup session restore that rebuilds renderer auth state from main-process session validation instead of trusting persisted renderer login state
- persisted auth-cookie jar alongside the normalized token so dev restarts can restore upstream session context more faithfully
- automatic clearing of stale persisted auth artifacts when startup revalidation reports an invalid session
- renderer settings page for interaction preferences and download-directory selection
- dedicated Favorites page with parallel local-collection and cloud-folder sections
- detail-header favorite menu for adding/removing resources from local collections without login
- cloud favorite folders can now open paginated folder contents through the upstream folder-patch API
- official-resource quick-download popovers on homepage cards and collection cards
- dedicated Downloads page with persisted per-file queue, progress, pause/resume/retry, and completion cleanup
- local SQLite-backed download queue with direct Cloudreve share resolution, presigned object downloads, and concurrent workers
- local Library page with persisted watch directories, rescans, linked-install cards, and unresolved-folder reporting

## Stack

- Electron 41
- electron-vite 5
- Vite 7
- React 19
- Zustand 5
- Tailwind CSS 4
- better-sqlite3

## Development

Requirements:

- Node.js 21.7+ recommended for the current Vite toolchain
- pnpm

Install and run:

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Platform builds:

- `pnpm build:win`
- `pnpm build:linux`

## Build Locally

For local development:

```bash
pnpm install
pnpm dev
```

For a production build:

```bash
pnpm exec electron-vite build
```

For a Windows 64-bit installer:

```bash
pnpm build:win
```

The current Windows target is an NSIS `x64` installer `.exe`, generated under `release/0.0.0/`.

## Roadmap

Implemented or active:

- left-nav refresh restore for primary app sections
- homepage browsing and refresh persistence
- keyword-oriented fuzzy search page with configurable scope toggles and upstream sorting
- Search-page NSFW mode toggle (`仅 SFW` / `仅 NSFW` / `全部内容`)
- local search-page `rating` sort to avoid broken upstream search `rating` ordering, with visible candidate-fetch / local-sort progress and in-progress paging
- main-process auth/session relay
- startup session revalidation so renderer login state follows the real main-process token on app reopen
- main-process persistence of both normalized auth token and upstream auth cookies, plus stale-auth cleanup on failed restore
- advanced homepage filtering and local rating-sort pipeline
- local collections CRUD through SQLite + IPC with a dedicated Favorites view
- cloud favorite folder overlays backed by the real `/user/profile/favorite/folder/patch` content feed
- checkpoint-based advanced-build resume without page-1 snapback during in-progress rendering
- homepage cards redesigned around feed-level browse data rather than detail-only metadata
- detail overlay with comments, ratings, screenshots, PV extraction, sectioned resource links, and session-aware discussion/evaluation gating
- detail overlay `Esc` key handling with layered close behavior between overlay and full-screen screenshot viewer
- full-screen screenshot navigation with on-screen arrows and keyboard left/right support
- detail resource chip fallback for upstream `row` type variants so resource cards render `生肉资源` instead of leaking raw API values
- settings-backed detail right-click behavior
- settings-backed download directory selection with default project-root `download/`
- homepage quick-download popover limited to TouchGal official `galgame` resources
- local-collection and cloud-collection card quick-download buttons
- Downloads nav/page with persisted task queue, progress, pause/resume/retry/delete, and clear-finished actions
- Library page with persisted watch roots, native directory picking, rescan workflow, linked local-path inventory, and unresolved last-scan reporting

Still in progress:

- broader use of the local metadata cache
- more complete local-first and offline-friendly browsing flows
- deeper library scanning and unknown-source folder matching remain deferred beyond the current `.tg_id`-first workflow

Known issue:

- homepage rating sort still depends on incomplete upstream candidate data in some cases; the local advanced pipeline fixes unstable upstream page ordering and duplication, but it cannot recover resources that the upstream rating query never returns
- search-page `rating` sort is rebuilt locally from stable search candidates, but completeness still depends on the underlying non-rating search candidate feed
- homepage feed cards currently display only the tag subset returned by upstream `/api/galgame`; fuller tag sets may exist only in `/api/patch/introduction`

Persistence status note:

- SQLite exists today as local persistence for user-owned app state, not as the primary source of truth for browse/detail data
- shipped SQLite-owned features now include local collections/favorites plus the download queue and per-file task state
- browse/detail resource persistence is still intentionally deferred as a primary source of truth until broader local-first flows are defined more concretely
- for now, persistent data with a clear local ownership story includes renderer UI restore state, main-process auth/session artifacts, local collections, download tasks, local file links, and future user-authored metadata

## Documentation

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

The docs set is current for left-nav refresh restore, homepage card interaction design, feed-vs-detail tag sourcing, homepage/search page-change scroll reset, the homepage state refactor, advanced-filter behavior, checkpoint-based advanced-build resume, Search-page scope/sort/NSFW controls, visible search-page rating-sort progress, incremental search-page rating rendering, rating-sort stabilization via the local catalog pipeline, main-process session relay rules, startup session revalidation, persisted auth-cookie restore/cleanup behavior, local-vs-cloud favorites architecture including cloud-folder content pagination, official-resource quick-download surfaces across homepage and collection cards, download-directory settings, the persisted concurrent download queue, the current local-library manager workflow, upstream download-type normalization such as `row -> raw`, full-screen screenshot navigation behavior, detail-overlay `Esc` handling, and the current detail-overlay data flow including session-aware social gating and post-login social refresh.

Lint note:

- the repository includes a `reference_project/` tree for comparison material; app linting excludes that tree so `pnpm lint` reports the local Electron app itself
