# Windows 11 Setup Guide

## Prerequisites

### Node.js
```powershell
winget install OpenJS.NodeJS.LTS
```
Minimum: **v20.19+** or **v22+**. Tested on: **v24.14.1**.
Open a **new terminal** after install for PATH to take effect.

### pnpm
```powershell
npm install -g pnpm
```

## Install & Run

```powershell
pnpm install
pnpm dev        # launches Electron with hot reload
```

## Build

```powershell
pnpm build:win  # outputs NSIS installer to release/<version>/
```

## Troubleshooting

**`Vite requires Node.js version 20.19+`**
Run `winget install OpenJS.NodeJS.LTS`, then open a new terminal.

**`Ignored build scripts: electron-winstaller`**
Run `pnpm approve-builds` and select `electron-winstaller`, or ensure `pnpm-workspace.yaml` has it in `onlyBuiltDependencies`.

**Dev window doesn't appear**
Check terminal for errors. electron-vite outputs build errors to stdout before launching Electron.
