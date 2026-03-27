# Vite 8 / Electron 41 Migration Guide

This guide documents the changes made during the migration from Vite 5 / Electron 30 to Vite 8 / Electron 41.

## ⚙️ Core Changes

### 1. Pure ESM Refactor
Vite 8 uses **Rolldown** as its default bundler, which strictly enforces ESM patterns. We refactored the main process from `createRequire` to **native ESM imports**.
- **Before**: Mixed `import` and `require('electron')`.
- **After**: Native `import { app, ... } from 'electron'`.

### 2. Module Externalization
In `vite.config.ts`, we explicitly **externalized** Node.js built-ins and `electron` for both the main and preload processes. This ensures Rolldown doesn't try to bundle native Electron APIs.
```typescript
external: ['electron', /^node:/, 'axios']
```

### 3. Build Configuration
- **Dist Directory**: The built main process is output to `dist-electron/main.js`.
- **Preload Output**: The preload script is bundled as `preload.mjs` for ESM compatibility.

## ⚠️ Known Issues & Solutions
- **Deprecation**: `inlineDynamicImports` is replaced by `codeSplitting: false` in Vite 8.
- **Rollup 4**: Removed `freeze` option is now ignored by Vite 8 but may cause warnings for older plugins.

## ✅ Verification
Successful build and packaging are confirmed for Linux (`AppImage`). Use `pnpm run build` to verify the production flow.
