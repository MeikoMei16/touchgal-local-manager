---
description: fix-electron-env
---

## Fix Electron Environment (Linux)

Use this workflow for:

- preload/main output desync
- Electron launch failures
- native module ABI mismatch
- broken local database during development

## Option A: Quick Refresh

```bash
pnpm clean
pnpm dev
```

## Option B: Full Rebuild

```bash
rm -rf out dist release node_modules pnpm-lock.yaml ~/.cache/electron
pnpm install
pnpm dev
```

## Option C: Native Module Rebuild Only

```bash
pnpm rebuild
pnpm dev
```

## Option D: Reset Local Database

Warning: this deletes the app's local SQLite database.

```bash
rm -f ~/.config/touchgal-local-manager/touchgal.db
pnpm dev
```
