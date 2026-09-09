// One-off endpoint: installs the persistent reply keyboard in the towers topic.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/gvg-tower-keyboard")({
  server: {
    handlers: {
      GET: async () => {
        const { installTowerKeyboard } = await import("@/lib/gvg-tower-form.server");
        const result = await installTowerKeyboard();
        return Response.json(result);
      },
      POST: async () => {
        const { installTowerKeyboard } = await import("@/lib/gvg-tower-form.server");
        const result = await installTowerKeyboard();
        return Response.json(result);
      },
    },
  },
});
