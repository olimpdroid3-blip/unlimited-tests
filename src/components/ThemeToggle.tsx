import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme-context";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label =
    theme === "dark"
      ? "Увімкнути світлу тему"
      : theme === "light"
        ? "Увімкнути темну тему"
        : "Перемкнути тему";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Moon className="size-4 dark:hidden" aria-hidden="true" />
      <Sun className="hidden size-4 dark:block" aria-hidden="true" />
    </button>
  );
}
