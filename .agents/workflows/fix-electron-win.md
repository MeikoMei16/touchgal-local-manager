---
description: fix-electron-win
---

## Fix Electron Environment (Windows)

Use this workflow for:

- native module mismatch
- stale preload/main outputs
- launch failures after dependency or Electron upgrades

## Option A: Quick Refresh

```powershell
pnpm clean
pnpm dev
```

## Option B: Full Rebuild

```powershell
Remove-Item -Recurse -Force node_modules, out, dist, release, pnpm-lock.yaml -ErrorAction SilentlyContinue
pnpm install
npx electron-rebuild -f -w better-sqlite3
pnpm dev
```

## Option C: Reset Local Database

Warning: this deletes the app's local SQLite database.

```powershell
Remove-Item "$env:APPDATA\touchgal-local-manager\touchgal.db" -ErrorAction SilentlyContinue
pnpm dev
```
