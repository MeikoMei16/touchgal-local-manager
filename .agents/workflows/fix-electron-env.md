---
description: fix-electron-env
---

## Fix Electron Runtime Environment

Use this workflow to resolve "not a function" errors, preload desyncs, or window launch failures.

### Option A: Quick Refresh (Preload/IPC Desyncs)
**Try this first.** It cleans build artifacts without re-downloading dependencies.

// turbo
1. **Clean Out/Dist Directories**
```bash
pnpm clean && pnpm dev
```

---

### Option B: Deep Reset (System/Dependency Issues)
Use if Option A fails or if you have ESM/CJS bundling errors.

1. **Nuclear Cleanup**
Removes build artifacts, dependencies, and system Electron cache.
```bash
rm -rf out dist dist-electron release node_modules pnpm-lock.yaml ~/.cache/electron/
```

2. **System Dependencies (Fedora/Linux)**
// turbo
```bash
sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrender libXtst cups-libs alsa-lib libXrandr pango cairo-gobject mesa-libGBM
```

3. **Fresh Install**
```bash
pnpm install && pnpm dev
```

---

### Option C: Database Reset
**WARNING: This deletes your local game metadata.** Use only if the SQLite database is corrupted.

1. **Remove Database**
```bash
rm -rf ~/.config/touchgal-local-manager/touchgal.db && pnpm dev
```
