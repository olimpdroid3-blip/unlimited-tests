import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/gvg-pin-bp")({
  server: {
    handlers: {
      GET: async () => {
        const { ensurePinnedBpMessage } = await import("@/lib/gvg-pinned-bp.server");
        const result = await ensurePinnedBpMessage(true);
        return Response.json(result);
      },
      POST: async () => {
        const { ensurePinnedBpMessage } = await import("@/lib/gvg-pinned-bp.server");
        const result = await ensurePinnedBpMessage(true);
        return Response.json(result);
      },
    },
  },
});
