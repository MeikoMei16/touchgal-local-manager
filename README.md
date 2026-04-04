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
- renderer settings page for interaction preferences
- early local SQLite and download-manager scaffolding

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
- advanced homepage filtering and local rating-sort pipeline
- checkpoint-based advanced-build resume without page-1 snapback during in-progress rendering
- homepage cards redesigned around feed-level browse data rather than detail-only metadata
- detail overlay with comments, ratings, screenshots, PV extraction, sectioned resource links, and session-aware discussion/evaluation gating
- detail overlay `Esc` key handling with layered close behavior between overlay and full-screen screenshot viewer
- full-screen screenshot navigation with on-screen arrows and keyboard left/right support
- detail resource chip fallback for upstream `row` type variants so resource cards render `生肉资源` instead of leaking raw API values
- settings-backed detail right-click behavior

Still in progress:

- broader use of the local metadata cache
- downloader flow beyond the current scaffold / persistence layer
- more complete local-first and offline-friendly browsing flows

Known issue:

- homepage rating sort still depends on incomplete upstream candidate data in some cases; the local advanced pipeline fixes unstable upstream page ordering and duplication, but it cannot recover resources that the upstream rating query never returns
- search-page `rating` sort is rebuilt locally from stable search candidates, but completeness still depends on the underlying non-rating search candidate feed
- homepage feed cards currently display only the tag subset returned by upstream `/api/galgame`; fuller tag sets may exist only in `/api/patch/introduction`

Persistence status note:

- SQLite exists today as schema/bootstrap groundwork, not as the primary source of truth for browse/detail data
- database-backed resource persistence is intentionally deferred until the UI and local-first flows that consume it are defined more concretely
- for now, only persist data with a clear local ownership story such as renderer UI restore state, auth/session artifacts managed by the main process, download tasks, local file links, and future user-authored metadata

## Documentation

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

The docs set is current for left-nav refresh restore, homepage card interaction design, feed-vs-detail tag sourcing, homepage/search page-change scroll reset, the homepage state refactor, advanced-filter behavior, checkpoint-based advanced-build resume, Search-page scope/sort/NSFW controls, visible search-page rating-sort progress, incremental search-page rating rendering, rating-sort stabilization via the local catalog pipeline, main-process session relay rules, startup session revalidation, upstream download-type normalization such as `row -> raw`, full-screen screenshot navigation behavior, detail-overlay `Esc` handling, and the current detail-overlay data flow including session-aware social gating and post-login social refresh.

Lint note:

- the repository includes a `reference_project/` tree for comparison material; app linting excludes that tree so `pnpm lint` reports the local Electron app itself
