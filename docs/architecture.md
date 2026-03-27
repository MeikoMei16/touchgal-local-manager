# Project Architecture

This project is a desktop application built with **Electron 41**, **Vite 8 (Rolldown)**, and **React 19**.

## Process Model

### 1. Main Process (`electron/main.ts`)
- **Responsibility**: System interaction (I/O, IPC), window management, and native API access.
- **Bootstrapping**: Bundled by Vite using native ESM. It listens for `VITE_DEV_SERVER_URL` during development.
- **APIs**: Exposes system-level functionality to the renderer via `ipcMain.handle`.

### 2. Preload Script (`electron/preload.ts`)
- **Responsibility**: Bridging the gap between the isolated renderer and the main process.
- **Security**: Exposes a safe `api` object to the `window` using `contextBridge`.
- **Packaging**: Bundled as a standalone ESM file (`preload.mjs`) to ensure fast loading and strict isolation.

### 3. Renderer Process (`src/`)
- **Responsibility**: User Interface and interaction logic (React 19).
- **Environment**: Sandboxed and separated from Node.js for security.
- **Communication**: Interacts with the Main process through the `window.api` bridge defined in the preload script.

## Core Technologies
- **Bundler**: Vite 8 (Rust-powered Rolldown).
- **UI Architecture**: React 19 + Zustand for state management.
- **Networking**: Axios (Externalized and handled in the Main process for CORS bypass).
