# Styling

Renderer styling is built with Tailwind CSS 4 and theme tokens defined in [`src/renderer/src/index.css`](/home/may/Documents/term3/project/touchgal-local-manager/src/renderer/src/index.css).

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

## Note

If you touch theme tokens, keep this document and `index.css` in sync. The CSS file is the source of truth.
