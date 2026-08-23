import { Link } from "@tanstack/react-router";

import type { ResourceSection } from "@/lib/resource-navigation";

type ResourceCardGridProps = {
  sections: ResourceSection[];
};

export function ResourceCardGrid({ sections }: ResourceCardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {sections.map((section) => (
        <Link
          key={section.to}
          to={section.to}
          className="group relative flex items-center gap-4 rounded-2xl border border-border bg-card/60 p-5 transition-all duration-200 hover:border-primary/50 hover:bg-card active:scale-[0.99] sm:flex-col sm:items-start sm:gap-3 sm:p-6"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-2xl sm:h-14 sm:w-14 sm:text-3xl">
            {section.icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground sm:text-xl">{section.title}</h2>
              <span className="text-primary opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100">
                →
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{section.subtitle}</p>
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
  );
}
