import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { notifyTowerToTelegram } from "@/lib/gvg-tower-notify.server";

export const notifyTower = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ nickname: z.string(), towerId: z.string() }).parse(data))
  .handler(async ({ data }) => notifyTowerToTelegram(data.nickname.trim(), data.towerId));
