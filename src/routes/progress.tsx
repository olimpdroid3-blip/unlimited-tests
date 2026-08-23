import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/AppHeader";
import { ResourceCardGrid } from "@/components/ResourceCardGrid";
import { PLAYER_PROGRESS_SECTIONS } from "@/lib/resource-navigation";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "БС та моби — Ukraine Unlimited" },
      {
        name: "description",
        content: "Бойова сила та рівні мобів учасників Ukraine Unlimited.",
      },
    ],
  }),
  component: PlayerProgressPage,
});

function PlayerProgressPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-8 sm:pt-12">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">БС та моби</h1>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Оберіть потрібний інструмент
          </p>
        </div>

        <ResourceCardGrid sections={PLAYER_PROGRESS_SECTIONS} />
      </main>
    </div>
  );
}
