export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "gvg.theme.v1";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(storedTheme: unknown, systemPrefersDark: boolean): Theme {
  if (isTheme(storedTheme)) {
    return storedTheme;
  }

  return systemPrefersDark ? "dark" : "light";
}

export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  const systemPrefersDark = typeof window.matchMedia === "function" && window.matchMedia("${THEME_MEDIA_QUERY}").matches;
  let storedTheme = null;

  try {
    storedTheme = window.localStorage.getItem("${THEME_STORAGE_KEY}");
  } catch {}

  const theme = storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : systemPrefersDark ? "dark" : "light";
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.dataset.theme = theme;
})();`;
