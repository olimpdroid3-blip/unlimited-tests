import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const loginTelegramAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ password: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { createAdminSession } = await import("@/lib/telegram-admin.server");
    const token = await createAdminSession(data.password);
    if (!token) return { ok: false as const, error: "Невірний пароль" };
    return { ok: true as const, token };
  });

export const checkTelegramAdminSession = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { verifyAdminSession } = await import("@/lib/telegram-admin.server");
    return { valid: await verifyAdminSession(data.token) };
  });

export const sendTelegramAdminTest = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(1),
        recipient: z.string().min(1).max(200),
        message: z.string().min(1).max(4000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { sendTelegramTestMessage } = await import("@/lib/telegram-admin.server");
    return sendTelegramTestMessage(data);
  });

export const syncTelegramRecipientsFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { syncTelegramRecipients } = await import("@/lib/telegram-admin.server");
    return syncTelegramRecipients(data.token);
  });

export const listTelegramRecipientsFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ token: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { listTelegramRecipients } = await import("@/lib/telegram-admin.server");
    return listTelegramRecipients(data.token);
  });

export const setTelegramRecipientEnabledFn = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(1),
        telegramUserId: z.number().int(),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { setTelegramRecipientEnabled } = await import("@/lib/telegram-admin.server");
    return setTelegramRecipientEnabled(data.token, data.telegramUserId, data.enabled);
  });
