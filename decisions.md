# Decision & Thinking Log

This document persists the architectural reasoning and "rules" for the TouchGal Local Manager (Electron Rebuild) project.

## 🧠 Core Architectural Decisions

### 1. IPC Relay for Network Access
- **Problem**: CORS (Cross-Origin Resource Sharing) restrictions in the Electron Renderer prevented direct access to the `touchgal.top` API, causing persistent "Network Error".
- **Solution**: Moved all API logic (`axios`) to the **Main Process** (Node.js). The Renderer now communicates via an IPC tunnel (`window.api`).
- **Status**: Implemented. Currently debugging "White Screen" (Renderer side crash).

### 2. 3717 (Android) Architecture Alignment
- **Pattern**: MVVM + Repository.
- **Data Layer**: `TouchGalClient` acts as the repository, abstracting the source (Remote API vs. Local File vs. Local Cache).
- **Zustand**: Used as the "ViewModel" state store.

## 🛠️ Environment-Specific Rules (Electron Fixes)

> [!IMPORTANT]
> The current development environment (cloud) has specific limitations for Electron.

1. **Manual Binary Download**: If `pnpm install` fails to setup Electron, download the `v30.0.1` zip manually and expand it to `node_modules\.pnpm\electron@30.5.1\node_modules\electron\dist`.
2. **ESM Path Fix**: `electron/main.ts` MUST include the `fileURLToPath` polyfill for `__dirname` and `__filename` because the project uses ES Modules.
3. **path.txt**: Always ensure `node_modules\...\electron\path.txt` points to `electron.exe`.

---
*Last update: 2026-03-27*
