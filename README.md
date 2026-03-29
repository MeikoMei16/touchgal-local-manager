# TouchGal Local Manager

TouchGal Local Manager is a high-performance, **local-first** desktop resource manager for galgames. It evolves from a simple web proxy into a premium local experience with offline search, integrated downloading, and one-click game launching.

## 🚀 Features

- **Local Metadata Engine**: Sub-100ms searching and filtering via SQLite FTS5.
- **Integrated Downloader**: Multi-storage link parsing (Baidu, Mega, etc.) with queue management.
- **Smart Linking**: Automatic association of local game folders with cloud metadata.
- **Premium UI**: Modern desktop aesthetics built with React 19 and Tailwind CSS 4.
- **Play Tracking**: Local-only tracking of play time and personal progress.

---

## 🛠️ Setup Guides

### Windows 11
1. **Prerequisites**:
   - Install Node.js LTS: `winget install OpenJS.NodeJS.LTS` (v22+ recommended).
   - Install pnpm: `npm install -g pnpm`.
2. **Install & Run**:
   ```powershell
   pnpm install
   pnpm dev
   ```
3. **Build**: `pnpm build:win` (outputs NSIS installer).

### Fedora / Linux
1. **Prerequisites**:
   - Install Node.js LTS (via `nvm` or `dnf`). Minimum v20.19+.
   - Install pnpm: `npm install -g pnpm`.
2. **System Dependencies**:
   ```bash
   sudo dnf install libX11 libXcomposite libXcursor libXdamage libXext libXfixes \
     libXi libXrender libXtst cups-libs alsa-lib libXrandr pango \
     cairo-gobject mesa-libGBM nss dbus-libs at-spi2-atk gdk-pixbuf2
   ```
3. **Install & Run**:
   ```bash
   pnpm install
   pnpm dev
   ```
4. **Build**: `pnpm build:linux` (outputs AppImage, rpm, and deb).

---

## 📖 Documentation

For a deep dive into the system design, process model, and data flow, see:
- [Architecture Documentation](docs/architecture.md)

---

## 🛠️ Tech Stack

- **Shell**: Electron 41
- **Bundler**: electron-vite / Vite 7
- **Frontend**: React 19, Zustand, Tailwind CSS 4
- **Database**: SQLite (better-sqlite3)
