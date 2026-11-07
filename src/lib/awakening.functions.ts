import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Same public-access model as the existing tower editor; no credentials in DTOs.
export const getAwakeningScouting = createServerFn({ method: "GET" }).handler(async () => {
  const { readAwakeningScouting } = await import("@/lib/awakening.server");
  return readAwakeningScouting();
});

export const clearTowersAndScouting = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ confirmation: z.literal("згоден") }).parse(input))
  .handler(async () => {
    const { clearAwakeningTowers } = await import("@/lib/awakening.server");
    try { return await clearAwakeningTowers(); }
    catch (error) {
      const message = error instanceof Error ? error.message : "";
      console.error("[awakening] atomic reset failed", /MATCH_CHANGED|TOWERS_CHANGED/.test(message) ? "snapshot conflict" : "RPC failure");
      return {
        ok: false as const,
        error: /MATCH_CHANGED|TOWERS_CHANGED/.test(message)
          ? "Матч або вежі змінилися. Дані оновлено; повторіть обидва підтвердження."
          : "Не вдалося очистити вежі. Оновіть дані та спробуйте ще раз.",
      };
    }
  });