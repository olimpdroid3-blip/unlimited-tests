// Maintenance endpoint: guarantees the pinned inline panel exists.
// `?remove=1` additionally drops any legacy bottom reply keyboard once.
import { createFileRoute } from "@tanstack/react-router";

async function run(request: Request) {
  const url = new URL(request.url);
  const mod = await import("@/lib/gvg-tower-form.server");
  const removed =
    url.searchParams.get("remove") === "1" ? await mod.removeLegacyTowerKeyboard() : null;
  const result = await mod.installTowerKeyboard();
  return Response.json({ ...result, legacy_keyboard_removed: removed?.ok ?? false });
}

export const Route = createFileRoute("/api/telegram/gvg-tower-keyboard")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
