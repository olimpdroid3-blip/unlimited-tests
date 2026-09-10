import { createFileRoute } from "@tanstack/react-router";

async function run() {
  const mod = await import("@/lib/gvg-pinned-review.server");
  const result = await mod.ensurePinnedReviewMessage(true);
  return Response.json(result);
}

export const Route = createFileRoute("/api/telegram/gvg-pin-review")({
  server: {
    handlers: {
      GET: () => run(),
      POST: () => run(),
    },
  },
});
