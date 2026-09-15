import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ArrowRight, BookOpen } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { FAQ_GUIDES } from "@/lib/faq-guides";
import { RESOURCE_BACK_LINKS } from "@/lib/resource-navigation";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ та гайди — NoNameClan" },
      {
        name: "description",
        content:
          "Як виставити деф, знайти проходку, змінити БС та рівні мобів. Інструкції з картинками та PDF.",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-6 sm:pt-10">
        <Link
          to={RESOURCE_BACK_LINKS["/faq"].to}
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:bg-accent"
        >
          ← На головну
        </Link>
        <header className="mb-8 mt-6">
          <BookOpen className="mb-3 size-8 text-primary" aria-hidden />
          <h1 className="text-3xl font-bold tracking-tight">FAQ та гайди</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Відповіді на часті запитання — з покроковими інструкціями й картинками. Читайте на сайті
            або завантажуйте PDF.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {FAQ_GUIDES.map((guide) => (
            <article
              key={guide.id}
              className="flex flex-col rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
            >
              <span className="mb-4 text-3xl" aria-hidden>
                {guide.icon}
              </span>
              <h2 className="text-lg font-semibold">
                <Link
                  to="/faq/$guideId"
                  params={{ guideId: guide.id }}
                  className="hover:text-primary"
                >
                  {guide.title}
                </Link>
              </h2>
              <p className="mb-6 mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {guide.description}
              </p>
              <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                <Link
                  to="/faq/$guideId"
                  params={{ guideId: guide.id }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Читати гайд <ArrowRight className="size-4" aria-hidden />
                </Link>
                <a
                  href={guide.pdf}
                  download
                  aria-label={`Завантажити PDF: ${guide.title}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Download className="size-4" aria-hidden /> PDF
                </a>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
