import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, ExternalLink } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { getFaqGuide, type GuideBlock } from "@/lib/faq-guides";

export const Route = createFileRoute("/faq_/$guideId")({
  loader: ({ params }) => {
    const guide = getFaqGuide(params.guideId);
    if (!guide) throw notFound();
    return guide;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Гайд не знайдено"} — NoNameClan` },
      { name: "description", content: loaderData?.description ?? "" },
    ],
  }),
  component: GuidePage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">Гайд не знайдено</h1>
      <Link to="/faq" className="mt-6 inline-block text-primary">
        ← До FAQ та гайдів
      </Link>
    </main>
  ),
});

function GuideContent({ block }: { block: GuideBlock }) {
  if (block.kind === "image") {
    return (
      <figure className="my-6">
        <a
          href={block.src}
          target="_blank"
          rel="noreferrer"
          aria-label={`Відкрити зображення: ${block.caption}`}
          className={`group relative block overflow-hidden rounded-xl border border-border bg-black ${block.layout === "dialog" ? "mx-auto aspect-[448/662] w-full max-w-md" : ""}`}
        >
          <img
            src={block.src}
            alt={block.caption}
            loading="lazy"
            decoding="async"
            className={
              block.layout === "dialog"
                ? "absolute -left-[92.857%] -top-[4.38%] w-[285.714%] max-w-none"
                : "h-auto w-full"
            }
          />
          <span
            className="absolute bottom-2 right-2 rounded-md bg-black/80 p-2 text-white"
            aria-hidden
          >
            <ExternalLink className="size-4" />
          </span>
        </a>
        <figcaption className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
          {block.caption}
        </figcaption>
      </figure>
    );
  }
  if (block.kind === "heading")
    return <h3 className="mb-2 mt-6 text-base font-semibold sm:text-lg">{block.text}</h3>;
  if (block.kind === "note")
    return (
      <aside className="my-5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm leading-relaxed">
        {block.text}
      </aside>
    );
  return <p className="my-3 text-sm leading-7 text-muted-foreground sm:text-base">{block.text}</p>;
}

function GuidePage() {
  const guide = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl px-4 pb-12 pt-6">
        <Link
          to="/faq"
          className="inline-flex rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground hover:bg-accent"
        >
          ← FAQ та гайди
        </Link>
        <header className="mb-8 mt-6">
          <span className="text-3xl" aria-hidden>
            {guide.icon}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{guide.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={guide.pdf}
              download
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Download className="size-4" aria-hidden /> Завантажити PDF
            </a>
            <Link
              to={guide.toolRoute}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-3 text-sm hover:bg-accent"
            >
              Відкрити розділ →
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Натисніть на картинку, щоб відкрити її в повному розмірі.
          </p>
        </header>
        {guide.sections.length > 1 && (
          <nav
            aria-label="Зміст гайду"
            className="mb-8 rounded-2xl border border-border bg-card/60 p-4 sm:p-5"
          >
            <h2 className="mb-3 font-semibold">У цьому гайді</h2>
            <ol className="space-y-2">
              {guide.sections.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#step-${index + 1}`}
                    className="block py-1 text-sm text-muted-foreground hover:text-primary"
                  >
                    {index + 1}. {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <article className="space-y-6">
          {guide.sections.map((section, index) => (
            <section
              id={`step-${index + 1}`}
              key={section.title}
              className="scroll-mt-24 rounded-2xl border border-border bg-card/40 p-4 sm:p-6"
            >
              <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
              {section.blocks.map((block, blockIndex) => (
                <GuideContent key={blockIndex} block={block} />
              ))}
            </section>
          ))}
        </article>
        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
          <Link to="/faq" className="text-sm text-muted-foreground hover:text-primary">
            ← Усі гайди
          </Link>
          <a
            href={guide.pdf}
            download
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent"
          >
            <Download className="size-4" aria-hidden /> Завантажити PDF
          </a>
        </footer>
      </main>
    </div>
  );
}
