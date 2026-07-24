import { Link } from "@tanstack/react-router";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-3 text-foreground">
          <span className="text-3xl">🏰</span>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-wide">GvG Вежі</div>
            <div className="text-[11px] text-muted-foreground">
              Watcher of Realms · керування вежами
            </div>
          </div>
        </Link>

        <Link
          to="/defenses"
          className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/20"
        >
          <span className="text-base leading-none">🛡</span>
          <span className="hidden sm:inline">База захистів</span>
          <span className="sm:hidden">База</span>
        </Link>
      </div>
    </header>
  );
}
