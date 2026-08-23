import { Link } from "@tanstack/react-router";

import bannerAsset from "@/assets/nonameclan-banner.jpg.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border">
      <div
        className="relative min-h-24 bg-cover sm:min-h-28"
        style={{ backgroundImage: `url(${bannerAsset.url})`, backgroundPosition: "center 62%" }}
      >
        {/* затемнення для читабельності елементів шапки */}
        <div className="absolute inset-0 bg-[oklch(0.12_0.03_260/0.35)]" />

        <div className="relative mx-auto flex min-h-24 max-w-5xl items-start justify-between gap-3 px-4 py-3 sm:min-h-28 sm:py-4">
          <Link to="/" className="flex min-w-0 flex-col leading-tight">
            <span className="sr-only">NoNameClan</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[oklch(0.95_0.02_250)] drop-shadow-[0_1px_3px_oklch(0.1_0_0/0.9)]">
              База ресурсів
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/"
              className="flex items-center gap-1.5 rounded-lg border border-[oklch(0.95_0.02_250/0.35)] bg-[oklch(0.12_0.03_260/0.45)] px-3 py-2 text-sm font-medium text-[oklch(0.97_0.01_250)] backdrop-blur-sm transition hover:bg-[oklch(0.12_0.03_260/0.7)]"
            >
              <span className="text-base leading-none">🏠</span>
              <span className="hidden sm:inline">Головна</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
