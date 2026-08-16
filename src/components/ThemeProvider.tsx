import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ThemeContext } from "@/components/theme-context";
import {
  isTheme,
  resolveTheme,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  toggleTheme,
  type Theme,
} from "@/lib/theme";

const themeColors: Record<Theme, string> = {
  light: "#faf9f7",
  dark: "#181a1f",
};

function readStoredTheme(): Theme | null {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.dataset.theme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", themeColors[theme]);
}

function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The active page can still change theme when browser storage is unavailable.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const storedTheme = readStoredTheme();
    const initialTheme = resolveTheme(storedTheme, mediaQuery.matches);
    applyTheme(initialTheme);
    setTheme(initialTheme);

    if (storedTheme) {
      return;
    }

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const systemTheme = resolveTheme(null, event.matches);
      applyTheme(systemTheme);
      setTheme(systemTheme);
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((currentTheme) => {
      const activeTheme =
        currentTheme ??
        resolveTheme(
          document.documentElement.dataset.theme,
          window.matchMedia(THEME_MEDIA_QUERY).matches,
        );
      const nextTheme = toggleTheme(activeTheme);

      document.documentElement.classList.add("theme-transition");
      applyTheme(nextTheme);
      persistTheme(nextTheme);
      window.setTimeout(() => {
        document.documentElement.classList.remove("theme-transition");
      }, 200);

      return nextTheme;
    });
  }, []);

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
