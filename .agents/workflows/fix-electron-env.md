---
description: fix-electron-env
---

1. Download the Electron `v30.0.1` win32-x64 zip.
// turbo
2. Run this powershell to repair the installation:
```powershell
$electronVer = "30.5.1";
$electronPkg = "node_modules\.pnpm\electron@$electronVer\node_modules\electron";
if (Test-Path "electron.zip") {
  New-Item -ItemType Directory -Path "$electronPkg\dist" -Force;
  Expand-Archive -Path "electron.zip" -DestinationPath "$electronPkg\dist" -Force;
  New-Item -ItemType File -Path "$electronPkg\path.txt" -Value "electron.exe" -Force;
}
```
3. Ensure `electron/main.ts` includes the ESM `__dirname` polyfill.
4. Run `pnpm run dev`.
