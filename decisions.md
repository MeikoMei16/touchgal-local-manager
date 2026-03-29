# Decision & Thinking Log

This document persists the architectural reasoning and "rules" for the TouchGal Local Manager project.

## Core Architectural Decisions

### 1. IPC Relay for Network Access
- **Problem**: CORS restrictions in the Electron Renderer prevent direct access to the `touchgal.top` API.
- **Solution**: All API logic (`axios`) lives in the **Main Process**. The Renderer communicates via IPC tunnel (`window.api`).
- **Rule**: Never call the TouchGal API directly from the renderer.

### 2. MVVM Architecture
- **Pattern**: MVVM + Repository.
- **Data Layer**: `TouchGalClient` (`src/renderer/src/data/`) acts as the repository, proxying all calls through `window.api`.
- **ViewModel**: Zustand store (`src/renderer/src/store/useTouchGalStore.ts`).

### 3. Tailwind CSS 4 + Material 3 Design System
- **Decision**: Adopt Tailwind CSS 4 for all UI styling, utilizing the new `@theme` configuration for Material 3 design tokens.
- **Goal**: Standardize the visual language, eliminate manual CSS-in-JS/inline styles, and improve developer experience.
- **Rule**: All component-level styling should use utility classes. Manual CSS is reserved for complex global utilities (e.g., glassmorphism) in `index.css`.

---

## Build Toolchain

### electron-vite (current)
The project uses **electron-vite** as the build system. This replaces the old `vite-plugin-electron` setup.

**Why the switch:**
- `vite-plugin-electron@0.29` had an ESM dynamic `import()` resolution bug under pnpm's isolated node_modules.
- `electron-vite` is the official, actively maintained build tool for Electron + Vite; it handles main/preload/renderer as three separate Vite environments.

**Locked versions:**
| Package | Version | Note |
|---|---|---|
| `vite` | `^7.x` | electron-vite@5 supports up to vite@7; vite@8 not yet supported |
| `electron-vite` | `^5.0.0` | |
| `@vitejs/plugin-react` | `^5.x` | v6 requires vite@8 |
| `tailwindcss` | `^4.x` | Adopted for utility-first styling |
| `@tailwindcss/vite` | `^4.x` | Integrated via Vite plugin |
| `typescript` | `^5.8.x` | typescript-eslint@8 requires TS < 6 |

### Directory Structure
```
src/
  main/         → Electron main process (index.ts)
  preload/      → Electron preload script (index.ts)
  renderer/
    index.html  → Renderer entry HTML
    src/        → React application
      App.tsx, main.tsx, index.css
      components/
      store/
      data/
      types/
      hooks/
      assets/
electron.vite.config.ts   → Build config for all three environments
electron-builder.json5    → Packaging config
```

### 3. Preload Script Constraint
- **Rule**: In projects with `"type": "module"`, the Preload script **must** be bundled as CommonJS with a `.cjs` extension.
- **Why**: Electron's `contextBridge` and `ipcRenderer` bindings are often bundled using `require()` by `electron-vite`. Native ESM (`.js`) does not support `require()`, leading to runtime errors.


---

## Build Commands

| Command | Platform | Output |
|---|---|---|
| `pnpm dev` | Any | Dev mode with hot reload |
| `pnpm build:win` | Windows | `release/<version>/*.exe` (NSIS) |
| `pnpm build:linux` | Linux | `release/<version>/` (AppImage + rpm + deb) |

> Cross-compilation not supported. Build on the target platform.

### 4. API Separation (Discovery)
- **Observation**: The "Advanced Filter" logic is split between two distinct API behaviors:
    - **No Keyword**: Hits `GET /api/galgame`. Filters are passed as URL query parameters.
    - **With Keyword**: Hits `POST /api/search`. Filters are passed in the JSON request body.
- **Implication**: UI changes to filters must ensure compatible data structures are sent to both endpoints, or unified into a single search-based flow if advanced logic (like ranges) is required.

---

*Last update: 2026-03-29*
