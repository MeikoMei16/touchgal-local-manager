# Fedora/Linux Setup Guide

To run this Electron application on Fedora (or other Linux distributions), certain system-level libraries are required for the Chromium engine to launch correctly.

## 📦 System Dependencies
Run the following command to install the necessary X11, media, and system libraries:
```bash
sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes libXi libXrender libXtst cups-libs alsa-lib libXrandr pango cairo-gobject mesa-libGBM
```

## 🛠️ Environment Configuration
- **Node.js**: Ensure you are using an LTS version (v20+ recommended).
- **pnpm**: This project uses **pnpm 10** for dependency management.
- **Electron Cache**: Electron binaries are cached in `~/.cache/electron/`. If you encounter launch issues, try clearing this directory using `rm -rf ~/.cache/electron/`.

## 🚀 Troubleshooting
- **Cannot find module 'electron'**: Run `pnpm install` specifically to trigger the `electron` post-install script.
- **Window won't open**: Ensure you have a graphics driver installed that supports OpenGL.
