import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  notifyMirrorOrderToTelegram,
  notifyTowerToTelegram,
} from "@/lib/gvg-tower-notify.server";

export const notifyTower = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ nickname: z.string(), towerId: z.string() }).parse(data))
  .handler(async ({ data }) => notifyTowerToTelegram(data.nickname.trim(), data.towerId));

export const notifyMirrorOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ nickname: z.string(), towerId: z.string() }).parse(data))
  .handler(async ({ data }) => notifyMirrorOrderToTelegram(data.nickname.trim(), data.towerId));
