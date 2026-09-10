import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { ResourceCardGrid } from "@/components/ResourceCardGrid";
import { RESOURCE_BACK_LINKS, WALKTHROUGH_SECTIONS } from "@/lib/resource-navigation";

export const Route = createFileRoute("/walkthroughs")({
  head: () => ({
    meta: [
      { title: "Проходки — NoNameClan" },
      {
        name: "description",
        content: "База проходок і відео проходок NoNameClan.",
      },
    ],
  }),
  component: WalkthroughsPage,
});

function WalkthroughsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-8 sm:pt-12">
        <Link
          to={RESOURCE_BACK_LINKS["/walkthroughs"].to}
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition hover:bg-accent"
        >
          ← {RESOURCE_BACK_LINKS["/walkthroughs"].label}
        </Link>
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Проходки</h1>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">Оберіть потрібний розділ</p>
        </div>

        <ResourceCardGrid sections={WALKTHROUGH_SECTIONS} />
      </main>
    </div>
  );
}
