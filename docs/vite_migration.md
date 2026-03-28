# Build Toolchain Migration History

## Current: electron-vite@5 + vite@7 (2026-03-27)

### What changed
- Replaced `vite-plugin-electron` + `vite-plugin-electron-renderer` with `electron-vite`
- Upgraded vite from 5.x → 7.x
- Restructured source tree to electron-vite convention:
  - `electron/` → `src/main/` and `src/preload/`
  - `src/` (renderer) → `src/renderer/src/`
  - `vite.config.ts` → `electron.vite.config.ts`
  - Root `index.html` → `src/renderer/index.html`
- Updated `tsconfig.json` to a project-references setup with `tsconfig.node.json` (main+preload) and `tsconfig.web.json` (renderer)
- Build output changed from `dist/` + `dist-electron/` → `out/main/`, `out/preload/`, `out/renderer/`
- Removed `shamefully-hoist=true` from `.npmrc` (no longer needed)
- **Preload Script Format Fix**: Since the project uses `"type": "module"`, all `.js` files are treated as ESM. The preload script, which contains CommonJS (`require`) for Electron bindings, must be output with a `.cjs` extension and explicit `format: 'cjs'` to avoid runtime `ReferenceError`.

### Linux (Fedora) Support
To run the Electron application on Fedora/Linux, the following system dependencies are required:
```bash
sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes \
  libXi libXrender libXtst cups-libs alsa-lib libXrandr pango \
  cairo-gobject mesa-libGBM nss dbus-libs at-spi2-atk gdk-pixbuf2
```
*Note: `mesa-libGBM` is critical for hardware acceleration on modern Fedora (Wayland).*

### Why electron-vite
- `vite-plugin-electron@0.29` used `await import("vite-plugin-electron-renderer")` at runtime — this ESM dynamic import fails under pnpm's isolated node_modules because the module is not in the importing package's dependency tree.
- `electron-vite` handles all three Vite environments (main/preload/renderer) natively without dynamic imports, making it fully compatible with pnpm.

### Version constraints
| Package | Version | Constraint |
|---|---|---|
| `electron-vite` | `^5.0.0` | Latest stable |
| `vite` | `^7.x` | electron-vite@5 peer dep ceiling |
| `@vitejs/plugin-react` | `^5.x` | v6 requires vite@8 |
| `typescript` | `^5.8.x` | `typescript-eslint@8` requires TS < 6 |

---

## Previous: vite-plugin-electron@0.28 + vite@5 (temporary workaround)

Downgraded to this combination to work around the pnpm ESM bug in 0.29.x.
This was a stopgap before the full electron-vite migration.

---

## Original: vite-plugin-electron@0.29 + vite@8 (Fedora, broken on Windows+pnpm)

Original development environment was Fedora with npm. Failed on Windows due to:
1. Node.js v20.11.0 < Vite 8 minimum requirement (v20.19+)
2. pnpm isolation breaking `vite-plugin-electron` dynamic import resolution
