import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const recreate = new URL(request.url).searchParams.get("recreate") === "1";
  const mod = await import("@/lib/gvg-pinned-towers.server");
  const result = recreate
    ? await mod.recreatePinnedTowersMessage()
    : await mod.ensurePinnedTowersMessage(true);
  return Response.json(result);
}

export const Route = createFileRoute("/api/telegram/gvg-pin-towers")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
