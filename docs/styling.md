# Styling

Renderer styling is built with Tailwind CSS 4 and theme tokens defined in [`src/renderer/src/index.css`](../src/renderer/src/index.css).

## Tooling

- Tailwind CSS 4
- `@tailwindcss/vite`
- no separate `tailwind.config.*`

## Theme Tokens

Current token groups include:

- primary / on-primary / primary-container
- secondary / on-secondary / secondary-container
- tertiary / on-tertiary / tertiary-container
- error / on-error / error-container
- surface and surface-container roles
- outline roles
- radius scale
- `font-main`
- `font-body`

## Typography

Current theme fonts:

- `font-main`: `Outfit`
- `font-body`: `Inter`

## Shared Utilities

Global helpers currently defined in `index.css`:

- `.glass`
- `.glass-dark`

Scrollbar styling is also defined globally there.

## Conventions

- Prefer Tailwind utility classes in JSX.
- Use theme tokens instead of hard-coded colors when possible.
- Keep component styling close to the component unless a pattern is reused broadly.
- Reserve global CSS for theme tokens and true cross-app utilities.

## Homepage Card Notes

Current homepage cards intentionally use a compact browse-first layout:

- show at most 3 feed tags inline under the date
- keep stats as bare icon-plus-number rows instead of pill containers
- reveal `收藏` / `下载` actions as right-edge vertical tabs on hover rather than full-width footer buttons
- fade the rating badge out on hover so the action tabs become the dominant interaction affordance

Reason:

- homepage browse cards are optimized for scan density and title legibility first
- the homepage feed only guarantees browse-level metadata, not fully enriched detail metadata
- keeping the card compact leaves more room for long titles and denser grids

Implementation note:

- current homepage cards are styled primarily in [`src/renderer/src/components/ResourceCard.tsx`](../src/renderer/src/components/ResourceCard.tsx)
- the rating badge currently uses a pale amber surface with dark amber foreground for stable contrast across varied banner artwork

## Floating Quick Panels

Current quick-action floating panels now follow two patterns:

- homepage card quick-collect remains card-local and computes a left/right side based on viewport position
- collection-card quick-download popovers render through `document.body` with fixed viewport positioning so card/overlay clipping does not confine them
- the shared quick-download popup now uses a deliberately wider panel footprint so full chip rows and longer resource titles remain legible

Reason:

- homepage cards already reserve explicit side rails for hover actions
- collection overlays and gallery cards use denser nested containers, so portaled positioning is more reliable there than local overflow rules alone
- once quick-download adopted the same metadata-chip model as the detail links panel, the earlier narrow popover no longer had enough horizontal room for the intended presentation

Implementation note:

- homepage card quick actions live in [`src/renderer/src/components/ResourceCard.tsx`](../src/renderer/src/components/ResourceCard.tsx)
- shared collection quick-download popup behavior lives in [`src/renderer/src/components/QuickDownloadPopoverButton.tsx`](../src/renderer/src/components/QuickDownloadPopoverButton.tsx)

## Note

If you touch theme tokens, keep this document and `index.css` in sync. The CSS file is the source of truth.
