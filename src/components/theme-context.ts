import { createContext, useContext } from "react";

import type { Theme } from "@/lib/theme";

export type ThemeContextValue = {
  theme: Theme | null;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
