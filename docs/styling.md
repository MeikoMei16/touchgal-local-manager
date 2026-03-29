# Styling & Design System

TouchGal Local Manager uses **Tailwind CSS 4** for all UI styling, following **Material 3 (M3)** design principles.

## 🛠️ Toolchain
- **Framework**: Tailwind CSS 4
- **Vite Integration**: `@tailwindcss/vite`
- **Configuration**: All theme tokens and global styles are defined in `src/renderer/src/index.css`. This project does **not** use a separate `tailwind.config.js`.

## 🎨 Design Tokens (Material 3)

The following tokens are available as Tailwind utility classes (e.g., `bg-primary`, `text-on-surface`).

### Color Palette
| Token | Variable | Description |
| :--- | :--- | :--- |
| **Primary** | `--color-primary` | Main brand color for key actions. |
| **Secondary** | `--color-secondary` | Used for less prominent UI elements. |
| **Surface** | `--color-surface` | Background color for pages and large containers. |
| **Error** | `--color-error` | Used for validation errors and destructive actions. |
| **Outline** | `--color-outline` | Subtle borders and dividers. |

> [!TIP]
> Use `*-container` and `on-*-container` roles for card backgrounds that need high contrast with their content.

### Typography
- **Display/Titles**: `font-main` ("Lexend") — Used for headers, game titles, and branding.
- **Body**: `font-body` ("Inter") — Used for descriptions, UI labels, and data.

### Rounded Corners
We use a standardized radius scale:
- `radius-sm` (8px): Inner elements/buttons.
- `radius-lg` (16px): Small cards/popovers.
- `radius-xl` (28px): Main content cards/Material 3 containers.
- `radius-2xl` (32px): Deeply rounded sections/Filter bar.

## ✨ Global UI Utilities

### Glassmorphism
We use custom global layers in `index.css` for consistent glass effects:
- `.glass`: Light theme translucent background with blur. Used for overlays and sidebars.
- `.glass-dark`: Dark/Elevated translucent background for high-contrast overlays.

### Scrolling
Scrollbars are standardized to be thin and unobtrusive:
- Width: 8px
- Style: Rounded, slate-200 thumb, transparent track.

## 📏 Best Practices
1. **Utility-First**: Avoid manual CSS. 99% of styling should be handled via Tailwind classes in JSX.
2. **Standardized Tokens**: Use `bg-surface-container` instead of hardcoded hex values for backgrounds.
3. **Responsive Grids**: Use Tailwind's `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` pattern to ensure the app works well on all window sizes.
4. **Active States**: Always provide visual feedback for clicks using `active:scale-95` or `active:bg-*` classes.
