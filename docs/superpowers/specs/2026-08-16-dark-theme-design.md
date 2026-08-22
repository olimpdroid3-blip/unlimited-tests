# Dark Theme Design

## Goal

Add an application-wide light/dark theme with a day/night toggle in the shared header. First-time visitors follow their operating-system preference; an explicit toggle is persisted locally.

## Theme model

The persisted preference is either `light` or `dark` under the versioned local-storage key `gvg.theme.v1`. When the key is absent, the resolved theme follows `prefers-color-scheme: dark`. The application listens for system theme changes only while no explicit preference exists.

The resolved theme is represented by a `.dark` class on the root `<html>` element. The document also receives the matching `color-scheme` value so native controls and browser-rendered surfaces use appropriate colors.

## First paint

The root document includes a small inline initialization script before application content. It reads the stored preference, falls back to the system media query, and applies `.dark` before React hydrates. Storage access is guarded so restricted browser storage cannot prevent the application from loading.

## React architecture

A focused theme module exports:

- theme types and the storage key;
- pure resolution and toggle helpers;
- DOM persistence/application helpers;
- `ThemeProvider` and `useTheme` for application components.

`ThemeProvider` owns the resolved React state, applies changes to `<html>`, persists explicit toggles, and subscribes to `prefers-color-scheme` while the preference is unset.

## Header control

`AppHeader` renders a compact icon button beside the existing Home link. It uses the current button and orange accent language, shows a moon for dark mode and a sun for light mode, and exposes an accessible label describing the action. The control remains usable on narrow mobile layouts.

## Visual tokens

The existing semantic CSS variables remain the only color API used by feature components. A `.dark` token set supplies graphite background, elevated card/popover surfaces, readable foreground and muted text, visible borders and inputs, destructive colors, tower states, and the existing orange primary accent.

Global background, text, border, and color transitions are short enough to feel smooth without delaying interaction. Reduced-motion preferences disable theme transition animation.

## Notifications

Create a shared theme-aware toaster wrapper using the resolved theme. Replace hard-coded `theme="light"` usages so notifications match manual overrides even when the operating-system theme differs.

## Failure behavior

If `localStorage` is unavailable or malformed, theme resolution falls back to the system preference. A failed persistence write still updates the active page theme for the current session.

## Testing

Unit tests cover stored preference precedence, system fallback, invalid values, and toggling. Existing application tests remain green. A production build verifies SSR and hydration compilation. Browser checks cover first-paint class application, persistence after reload, header button state, light/dark token rendering, theme-aware toasts, and the absence of hydration or controlled-state warnings.
