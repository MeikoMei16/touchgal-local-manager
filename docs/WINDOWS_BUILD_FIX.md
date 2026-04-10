# Windows Build Native Module Fix

## Problem
When building the project for Windows on a Linux host, native modules like `better-sqlite3` were being packaged with Linux-specific **ELF** binaries instead of Windows **PE** binaries. This caused the application to fail during installation or startup on Windows with errors indicating that the module is not a valid Win32 application.

## Root Cause
`electron-builder` and `@electron/rebuild` on Linux default to building native modules for the host operating system (Linux) unless explicitly configured otherwise. Even with target flags for Windows, fetching prebuilt binaries for a different platform doesn't always happen correctly during the standard rebuild phase.

## Solution
The fix involves two steps:
1.  **Manual Binary Fetch**: Use `prebuild-install` to explicitly download the `win32 x64` prebuilt binary for the target Electron version and runtime.
2.  **Bypass Rebuild**: Configure `electron-builder` to skip the `npmRebuild` phase during packaging so that it uses the manually fetched Windows binary instead of attempting (and failing) to rebuild for Linux.

## Automated Workflow
The build process is now automated through the following scripts in `package.json`:

### 1. Windows Preparation
```bash
npm run build:win:prep
```
This runs `prebuild-install` with the following flags:
- `--platform win32`
- `--arch x64`
- `--target 41.1.0` (Current Electron Version)
- `--runtime electron`

### 2. Windows Build
```bash
npm run build:win
```
This runs the preparation script first, then executes the Vite build, and finally runs `electron-builder` with `-c.npmRebuild=false` to preserve the Windows binaries.

## Restoring Local Environment
Since the `build:win:prep` script overwrites your local `better-sqlite3` binary with the Windows version, you will need to restore the Linux version for local development:
```bash
pnpm install
# OR
npm run rebuild
```
