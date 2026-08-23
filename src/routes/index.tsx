import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { NicknameInput } from "@/components/NicknameInput";
import { ResourceCardGrid } from "@/components/ResourceCardGrid";
import { LANDING_SECTIONS } from "@/lib/resource-navigation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ukraine Unlimited — База ресурсів" },
      {
        name: "description",
        content: "Ukraine Unlimited · Watcher of Realms — база інструментів та ресурсів гільдії.",
      },
      { property: "og:title", content: "Ukraine Unlimited — База ресурсів" },
      {
        property: "og:description",
        content: "Watcher of Realms · база інструментів та ресурсів гільдії.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-8 sm:pt-12">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">База ресурсів</h1>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Watcher of Realms · база інструментів та ресурсів
          </p>
        </div>

        <NicknameInput />

        <ResourceCardGrid sections={LANDING_SECTIONS} />
      </main>
    </div>
  );
}
