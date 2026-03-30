---
description: fix-electron-win
---

## Fix Electron Runtime Environment (Windows)

Use this workflow to resolve "not a function" errors, native module (SQLite) mismatches, or window launch failures on Windows.

### Option A: Quick Refresh
Cleans build artifacts without re-downloading dependencies.

// turbo
1. **Clean & Restart**
```powershell
pnpm clean; pnpm dev
```

---

### Option B: Deep Reset (OS Migration/System Issues)
Use if you have native module errors (e.g., `better-sqlite3` fails to load) or after switching to Windows.

#### 1. Nuclear Cleanup
Removes build artifacts, dependencies, and pnpm lockfile.
```powershell
Remove-Item -Recurse -Force node_modules, out, dist, pnpm-lock.yaml -ErrorAction SilentlyContinue
```

#### 2. System Dependencies
> [!IMPORTANT]
> You MUST have **Visual Studio Build Tools** with "C++ desktop development" installed to compile `better-sqlite3`.

#### 3. Fresh Install & Rebuild
```powershell
pnpm install
# Force rebuild native modules for Electron
npx electron-rebuild -f -w better-sqlite3
pnpm dev
```

---

### Option C: Database Reset
**WARNING: This deletes your local game metadata.**

#### 1. Remove Database
```powershell
Remove-Item "$env:APPDATA\touchgal-local-manager\touchgal.db" -ErrorAction SilentlyContinue; pnpm dev
```
