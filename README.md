# TouchGal Local Manager

Electron desktop client for browsing TouchGal resources with a local-state-heavy UX, advanced homepage filtering, and room for future local-first features.

## Current Focus

- upstream API relay through Electron main process
- normalized session/token handling in the main-process relay
- React renderer with Zustand state
- persisted homepage browse state with hydration-aware refresh restore
- advanced homepage filtering with local tag enrichment
- detail overlay for introduction, extracted screenshots/PV media, grouped resource links, ratings, and comments
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

## Documentation

- [docs/README.md](docs/README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/advanced-filter.md](docs/advanced-filter.md)
- [docs/decisions.md](docs/decisions.md)
- [docs/styling.md](docs/styling.md)

The docs set is current for the homepage state refactor, advanced-filter behavior, main-process session relay rules, and the current detail-overlay data flow.
