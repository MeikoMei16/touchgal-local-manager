# TouchGal Local Manager Agent Knowledge

This file captures specific technical knowledge for future AI agents working on this codebase.

## 🧬 Project DNA
- **Framework**: Vite 8 + Electron 41 + React 19.
- **Package Manager**: pnpm 10.
- **Target OS**: Fedora/Linux (Primary).

## 🛠️ Specialized Setup Knowledge

### 1. ESM/Rolldown Requirements
- **ESM-Only**: The Main and Preload processes **MUST** use native ESM `import` statements. 
- **NO `createRequire`**: Do not use `createRequire` or `require()` in the Electron process files, as this triggers Rolldown bundling errors.
- **Externalization**: In `vite.config.ts`, `electron` and `node:*` modules must be externalized to avoid being bundled.

### 2. Fedora Runtime
- **System Libs**: Fedora needs `libX11`, `libXcomposite`, etc. (See `docs/fedora_setup.md`).
- **Cache**: Electron binary issues are often fixed by clearing `~/.cache/electron/`.

### 3. Build Artifacts
- **Main**: Outputs to `dist-electron/main.js`.
- **Preload**: Outputs to `dist-electron/preload.mjs`.

## 🔄 Common Workflows
- **Fixing Environment**: Run `/fix-electron-env` to reset the cache, install dependencies, and rebuild native modules.
- **Native Rebuild**: `pnpm install` automatically triggers `@electron/rebuild` for the current platform/version.
