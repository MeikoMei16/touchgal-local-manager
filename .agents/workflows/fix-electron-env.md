---
description: fix-electron-env
---

## Fix Electron Runtime Environment

Use this workflow if the Electron window fails to launch or if there are ESM/CJS bundling errors.

1. **Clean Project & System Architecture**
Run this to remove build artifacts and the system Electron cache:
```bash
rm -rf dist dist-electron release node_modules pnpm-lock.yaml ~/.cache/electron/
```

2. **Install System Dependencies (Fedora)**
// turbo
```bash
sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrender libXtst cups-libs alsa-lib libXrandr pango cairo-gobject mesa-libGBM
```

3. **Re-install Dependencies**
Ensure proper Electron binary download for Linux:
```bash
pnpm install
```

4. **Verify ESM Configuration**
Ensure `electron/main.ts` uses native ESM `import` statements and **NOT** `createRequire`.

5. **Run Development Mode**
```bash
pnpm run dev
```
