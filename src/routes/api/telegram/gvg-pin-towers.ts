import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/gvg-pin-towers")({
  server: {
    handlers: {
      GET: async () => {
        const { ensurePinnedTowersMessage } = await import("@/lib/gvg-pinned-towers.server");
        const result = await ensurePinnedTowersMessage(true);
        return Response.json(result);
      },
      POST: async () => {
        const { ensurePinnedTowersMessage } = await import("@/lib/gvg-pinned-towers.server");
        const result = await ensurePinnedTowersMessage(true);
        return Response.json(result);
      },
    },
  },
});
