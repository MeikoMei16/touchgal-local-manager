# Fedora/Linux Setup Guide

## Prerequisites

### Node.js
```bash
# via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts

# or via dnf (Fedora 38+, may be older version)
sudo dnf install nodejs npm
```
Minimum: **v20.19+**. Tested on: **v22 LTS**.

### pnpm
```bash
npm install -g pnpm
```

## System Dependencies

Electron requires these system libraries for Chromium:

```bash
sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes \
  libXi libXrender libXtst cups-libs alsa-lib libXrandr pango cairo-gobject mesa-libGBM
```

## Install & Run

```bash
pnpm install
pnpm dev        # launches Electron with hot reload
```

## Build

```bash
pnpm build:linux  # outputs AppImage + rpm + deb to release/<version>/
```

## Troubleshooting

**`Cannot find module 'electron'`**
```bash
rm -rf ~/.cache/electron/
pnpm install
```

**`Ignored build scripts: electron-winstaller`**
Harmless on Linux — `electron-winstaller` is Windows-only and unused during `build:linux`.
