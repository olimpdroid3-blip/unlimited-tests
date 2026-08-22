# Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flash-free application-wide light/dark theme with a persistent day/night toggle in the shared header.

**Architecture:** Keep deterministic theme resolution in a pure library, own browser state in a React context provider, and apply the resolved mode through a root `.dark` class and semantic CSS variables. Run an inline bootstrap script before hydration, and route every Sonner instance through a shared theme-aware wrapper.

**Tech Stack:** React 19, TanStack Start, TypeScript, Tailwind CSS v4, Sonner, Node test runner.

## Global Constraints

- Persist only `light` or `dark` under `gvg.theme.v1`.
- With no explicit preference, follow `prefers-color-scheme: dark`, including later system changes.
- Apply the resolved mode to `<html>` before hydration and set matching `color-scheme`.
- Keep feature components on semantic CSS tokens and preserve the orange primary accent.
- Storage failures must never prevent rendering or an in-session theme change.
- Disable theme transition animation when `prefers-reduced-motion: reduce` is active.

---

### Task 1: Deterministic theme model

**Files:**
- Create: `src/lib/theme.ts`
- Test: `src/lib/theme.test.ts`

**Interfaces:**
- Produces: `Theme`, `THEME_STORAGE_KEY`, `isTheme(value)`, `resolveTheme(stored, systemDark)`, `toggleTheme(theme)`, and `THEME_BOOTSTRAP_SCRIPT`.

- [ ] **Step 1: Write failing unit tests** for stored preference precedence, system fallback, invalid values, and light/dark toggling.
- [ ] **Step 2: Run `node --test --import tsx src/lib/theme.test.ts`** and verify it fails because `src/lib/theme.ts` does not exist.
- [ ] **Step 3: Implement the pure helpers and guarded inline bootstrap script** using the exact storage key `gvg.theme.v1`.
- [ ] **Step 4: Re-run the focused test** and verify every assertion passes.
- [ ] **Step 5: Commit** with `git commit -m "feat: add theme resolution model"`.

### Task 2: Theme provider and header toggle

**Files:**
- Create: `src/components/ThemeProvider.tsx`
- Create: `src/components/ThemeToggle.tsx`
- Modify: `src/components/AppHeader.tsx`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Consumes: `Theme`, `THEME_STORAGE_KEY`, `resolveTheme`, `toggleTheme`, and `THEME_BOOTSTRAP_SCRIPT` from Task 1.
- Produces: `ThemeProvider`, `useTheme()`, and a shared accessible `ThemeToggle` button.

- [ ] **Step 1: Add `ThemeProvider`** that safely reads storage, applies the class and `color-scheme`, persists manual toggles, and listens to system changes only without an explicit preference.
- [ ] **Step 2: Add `ThemeToggle`** with sun/moon icons, an accessible Ukrainian action label, a compact mobile-safe button, and a reduced-motion-safe transition class during manual changes.
- [ ] **Step 3: Mount the provider and bootstrap script in the root shell** before rendered application content and add `suppressHydrationWarning` to `<html>`.
- [ ] **Step 4: Place the toggle beside the existing Home action** without changing route behavior.
- [ ] **Step 5: Run the focused theme unit test and TypeScript production build** and fix only failures introduced by this task.
- [ ] **Step 6: Commit** with `git commit -m "feat: add persistent theme toggle"`.

### Task 3: Dark semantic tokens and notifications

**Files:**
- Modify: `src/styles.css`
- Modify: `src/components/ui/sonner.tsx`
- Modify: `src/routes/battle-power.tsx`
- Modify: `src/routes/mob-levels_.edit.tsx`
- Modify: `src/routes/towers.tsx`
- Modify: `src/routes/defenses.tsx`

**Interfaces:**
- Consumes: `useTheme()` from Task 2.
- Produces: a graphite `.dark` token palette and the single theme-aware UI `Toaster` wrapper.

- [ ] **Step 1: Add the `.dark` semantic token set** for backgrounds, surfaces, text, borders, inputs, destructive states, towers, columns, and orange accent contrast.
- [ ] **Step 2: Add short root transition rules** gated by `prefers-reduced-motion: no-preference`.
- [ ] **Step 3: Make `src/components/ui/sonner.tsx` consume `useTheme()`** and pass the resolved light/dark value to Sonner.
- [ ] **Step 4: Replace route-local `Toaster` imports** with the shared wrapper while retaining each route's position and `richColors` options.
- [ ] **Step 5: Run all Node tests, targeted ESLint, and `npm run build`** and verify they pass.
- [ ] **Step 6: Commit** with `git commit -m "feat: style application dark theme"`.

### Task 4: Browser acceptance check

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: the completed theme implementation.
- Produces: browser evidence for persistence, visuals, accessibility state, and clean hydration.

- [ ] **Step 1: Start the local development server** on an available port.
- [ ] **Step 2: Open the home page and confirm** the header toggle is visible and the root background uses semantic tokens.
- [ ] **Step 3: Toggle the mode and reload** to verify the manually selected theme persists.
- [ ] **Step 4: Open a page with notifications** and verify Sonner follows the selected mode.
- [ ] **Step 5: Inspect browser console output** and confirm there are no hydration or controlled-state warnings.
- [ ] **Step 6: Run `git status --short` and review the diff** before the final handoff.
