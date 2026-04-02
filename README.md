[![English](https://img.shields.io/badge/Language-English-blue?style=for-the-badge)](./README.md)
[![中文](https://img.shields.io/badge/%E8%AF%AD%E8%A8%80-%E4%B8%AD%E6%96%87-lightgrey?style=for-the-badge)](./README.zh-CN.md)

# TouchGal Local Manager

Electron desktop client for browsing TouchGal resources with a local-state-heavy UX, advanced homepage filtering, and room for future local-first features.

## Current Focus

- upstream API relay through Electron main process
- normalized session/token handling in the main-process relay
- React renderer with Zustand state
- persisted homepage browse state with hydration-aware refresh restore
- advanced homepage filtering and rating sorting with a local catalog pipeline, including release-date hydration for correct release-year filtering
- detail overlay for introduction, extracted screenshots/PV media, sectioned resource links, ratings, comments, and configurable right-click back behavior
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

- homepage browsing and refresh persistence
- main-process auth/session relay
- advanced homepage filtering and local rating-sort pipeline
- detail overlay with comments, ratings, screenshots, PV extraction, and sectioned resource links
- settings-backed detail right-click behavior

Still in progress:

- broader use of the local metadata cache
- downloader flow beyond the current scaffold / persistence layer
- more complete local-first and offline-friendly browsing flows

## Documentation

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

The docs set is current for the homepage state refactor, advanced-filter behavior, rating-sort stabilization via the local catalog pipeline, main-process session relay rules, and the current detail-overlay data flow.
