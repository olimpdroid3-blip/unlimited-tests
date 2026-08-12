import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { NicknameInput } from "@/components/NicknameInput";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ukraine Unlimited — База ресурсів" },
      {
        name: "description",
        content:
          "Ukraine Unlimited · Watcher of Realms — база інструментів та ресурсів гільдії.",
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

type SectionCard = {
  to: "/towers" | "/defenses" | "/battle-power" | "/videos";
  icon: string;
  title: string;
  subtitle: string;
};

const SECTIONS: SectionCard[] = [
  {
    to: "/towers",
    icon: "🏰",
    title: "Вежі",
    subtitle: "GvG · 48 позицій веж",
  },
  {
    to: "/defenses",
    icon: "🛡",
    title: "База захистів",
    subtitle: "Скріншоти · коди проходок · пошук по героях",
  },
  {
    to: "/battle-power",
    icon: "💪",
    title: "Бойова Сила",
    subtitle: "Збереження бойової сили учасників",
  },
  {
    to: "/videos",
    icon: "🎥",
    title: "Відео проходок",
    subtitle: "Пошук відео з Telegram по героях",
  },
];


function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-10 pt-8 sm:pt-12">
        <div className="mb-8 text-center sm:mb-12">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            База ресурсів
          </h1>
          <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
            Watcher of Realms · база інструментів та ресурсів
          </p>
        </div>

        <NicknameInput />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {SECTIONS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-5 transition-all duration-200 hover:border-primary/50 hover:bg-card active:scale-[0.99] sm:flex-col sm:items-start sm:gap-3 sm:p-6"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-2xl sm:h-14 sm:w-14 sm:text-3xl">
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground sm:text-xl">
                    {s.title}
                  </h2>
                  <span className="text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
                    →
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                  {s.subtitle}
                </p>
              </div>
              <span
                aria-hidden
                className="hidden self-center text-lg text-muted-foreground transition group-hover:text-primary sm:block"
              >
                →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
