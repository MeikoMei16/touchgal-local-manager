# Decision & Thinking Log

This document persists architectural reasoning, rules, and hard-won lessons for the TouchGal Local Manager project.

*Last update: 2026-03-30*

---

## Core Architectural Decisions

### 1. IPC Relay for Network Access
- **Problem**: CORS restrictions in the Electron Renderer prevent direct access to the `touchgal.top` API.
- **Solution**: All API logic (`axios`) lives in the **Main Process**. The Renderer communicates via IPC tunnel (`window.api`).
- **Rule**: Never call the TouchGal API directly from the renderer.

### 2. MVVM Architecture
- **Pattern**: MVVM + Repository.
- **Data Layer**: `TouchGalClient` (`src/renderer/src/data/`) acts as the repository, proxying all calls through `window.api`.
- **ViewModel**: Zustand store (`src/renderer/src/store/useTouchGalStore.ts`).

### 3. Tailwind CSS 4 + Design System
- **Decision**: Tailwind CSS 4 for all UI styling with `@theme` configuration.
- **Rule**: All component-level styling uses utility classes. Manual CSS is reserved for complex global utilities in `index.css`.

### 4. `/api/search` is BANNED for tag filtering
- **Problem**: The `/api/search` endpoint's tag filtering returns unreliable results.
- **Rule**: Never use `/api/search` for tag-based filtering. Use the three-stage pipeline instead.
- **Alternative**: Tags are filtered via Stage 3 downstream enrichment using `getPatchIntroduction`.

---

## Build Toolchain

### electron-vite
The project uses **electron-vite** as the build system.

**Locked versions:**
| Package | Version | Note |
|---|---|---|
| `vite` | `^7.x` | Requires Node.js v21.7.0+ due to `crypto.hash` |
| `electron-vite` | `^5.0.0` | |
| `@vitejs/plugin-react` | `^5.x` | v6 requires vite@8 |
| `tailwindcss` | `^4.x` | |
| `typescript` | `^5.8.x` | typescript-eslint@8 requires TS < 6 |

**Node.js version**: Must use **v21.7.0+** (project environment: v24.14.1). The Accio agent shell uses an older bundled Node (v20.x) — always prefix dev commands with `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH`.

### Build Commands
| Command | Platform | Output |
|---|---|---|
| `pnpm dev` | Any | Dev mode with hot reload |
| `pnpm build:win` | Windows | `release/<version>/*.exe` (NSIS) |
| `pnpm build:linux` | Linux | `release/<version>/` (AppImage + rpm + deb) |

### Preload Script Constraint
- **Rule**: The Preload script **must** be bundled as CommonJS with a `.cjs` extension.
- **Why**: Electron's `contextBridge` requires `require()`; native ESM does not support it.

---

## API Behavior Notes

### Field Mapping Gotchas
| Field | Wrong | Correct |
|---|---|---|
| Rating count | `resource.averageRatingCount` | `resource.ratingSummary.count` |
| Tags | `resource.tag[].name` | `resource.tag[].tag.name ?? resource.tag[].name` |
| Company | Assumed string | Can be `string` OR `Array<{name: string}>` — normalize in `normalizeIntroduction()` |

### API Endpoint Reference
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/galgame` | GET | Game list. Supports `nsfwMode`, `selectedPlatform`, `minRatingCount`, `tagString` (unreliable), `yearString`, `sortField`, `sortOrder` |
| `/api/patch` | GET | Game detail by `uniqueId` |
| `/api/patch/introduction` | GET | Tags, company, alias, dates, external IDs |
| `/api/patch/resource` | GET | Download resource list by `patchId` |
| `/api/auth/captcha` | GET | Fetch captcha image/challenge |
| `/api/auth/login` | POST | Login with `{ name, password, captcha }` |
| `pan.touchgal.net/api/v3/share/download/{shareId}` | **PUT** | Resolve Cloudreve share to S3 pre-signed URL (1 hour TTL) |

---

## Three-Stage Pipeline Design

### Why not just use API tag filtering?
`/api/galgame?tagString=["纯爱"]` returns incorrect results. The only reliable way to filter by tag is to fetch the full `introduction` for each candidate and match locally.

### Why stream pages instead of waiting for all pages?
Users see results appearing incrementally. If midstream filters are aggressive (e.g. minRatingScore=9.0), the candidate pool is tiny and Stage 3 IO is minimal.

### Stage isolation rules
- Stage 1 params MUST go to the API — never re-apply them in `applyAdvancedPredicate`
- Stage 2 predicate is a pure function — no async, no IO
- Stage 3 enrichment only runs when `selectedTags.length > 0`
- Un-hydrated cards remain visible during Stage 3 (optimistic rendering); they get filtered out once their tags arrive

---

## UI/UX Patterns

### FilterBar Dropdown
- Tag suggestion dropdown uses `onMouseDown + e.preventDefault()` on items to prevent `onBlur` from closing the list before the click registers.
- Parent container must have `overflow-visible` (not `overflow-hidden`) or the dropdown gets clipped.

### Captcha Reset on Login Failure
- After a failed login, set `captchaChallenge` to `null` BEFORE calling `fetchCaptcha()`.
- This ensures the `useEffect([captchaChallenge])` in `LoginModal` detects the `null → value` transition and re-opens the challenge panel.
- If you set it directly from old-value to new-value, React sees no change and the effect does not fire.

### BlurredSection
- Auth-gated content areas use `<BlurredSection isLoggedIn={isLoggedIn}>`.
- Rating histogram is NOT gated — all users can see score distribution.
- User evaluations and comments ARE gated.

---

## Lessons Learned

### 2026-03-30
- `crypto.hash` was introduced in Node.js v21.7.0. Vite 7 requires it. The Accio agent shell runs an older bundled Node; always override PATH when running dev commands.
- `edit` tool fails silently on CRLF files when the old_string contains `\n` instead of `\r\n`. Use PowerShell `[System.IO.File]::ReadAllText/WriteAllText` for reliable file manipulation, or use the `write` tool for full rewrites.
- Repeated PowerShell patches on the same file can cause content duplication if the matching anchor appears multiple times. Always `git checkout HEAD -- <file>` to restore before a rewrite.
- The `applyAdvancedPredicate` function should only handle Stage 2 and Stage 3 filtering. Stage 1 fields (platform, minRatingCount) are already filtered server-side — re-applying them wastes cycles and can produce incorrect results if the user changes them mid-session.
