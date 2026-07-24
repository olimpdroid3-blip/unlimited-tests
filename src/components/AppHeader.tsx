import { Link } from "@tanstack/react-router";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-foreground">
          <span className="text-xl">🏰</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide">GvG Вежі</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Watcher of Realms
            </div>
          </div>
        </Link>
      </div>
    </header>
  );
}
