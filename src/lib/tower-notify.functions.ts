import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  deleteTelegramMessage,
  notifyMirrorOrderToTelegram,
  notifyTowerToTelegram,
} from "@/lib/gvg-tower-notify.server";

export const notifyTower = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ nickname: z.string(), towerId: z.string() }).parse(data))
  .handler(async ({ data }) => notifyTowerToTelegram(data.nickname.trim(), data.towerId));

export const notifyMirrorOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ nickname: z.string(), towerId: z.string() }).parse(data))
  .handler(async ({ data }) => notifyMirrorOrderToTelegram(data.nickname.trim(), data.towerId));

export const deleteTowerMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ messageId: z.number().int().positive() }).parse(data))
  .handler(async ({ data }) => deleteTelegramMessage(data.messageId));

/** Shared request creation used by the website form (Telegram uses it directly). */
export const submitTowerRequest = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        towerId: z.string().min(1),
        nickname: z.string().min(1),
        screenshotUrl: z.string().nullable().optional(),
        screenshotPath: z.string().nullable().optional(),
        comment: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createTowerRequest } = await import("@/lib/gvg-tower-requests.server");
    return createTowerRequest({
      towerId: data.towerId,
      nickname: data.nickname.trim(),
      screenshotUrl: data.screenshotUrl ?? null,
      screenshotPath: data.screenshotPath ?? null,
      comment: data.comment ?? null,
      source: "web",
    });
  });

/** Shared removal: drops the marker row, deletes the Telegram update, posts "➖". */
export const dropTowerRequest = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ towerId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { removeTowerRequest } = await import("@/lib/gvg-tower-requests.server");
    return removeTowerRequest(data.towerId);
  });

/** Records that the current tower entry was created or updated on the website. */
export const markTowerWebOrigin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ towerId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const [{ saveTowerOrigin }, { buildTowerSiteUrl }] = await Promise.all([
      import("@/lib/tower-origin.server"),
      import("@/lib/tower-origin"),
    ]);
    await saveTowerOrigin(
      {
        tower_id: data.towerId,
        source: "web",
        telegram_message_id: null,
        telegram_message_link: null,
        site_url: buildTowerSiteUrl(data.towerId),
        created_at: new Date().toISOString(),
      },
      false,
    );
    return { ok: true };
  });
