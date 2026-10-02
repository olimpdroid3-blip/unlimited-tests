import { createTelegramSourcesCache } from "@/lib/telegram-sources-cache";

type Cache = ReturnType<typeof createTelegramSourcesCache>;
const g = globalThis as { __telegramSourcesCache?: Cache };

export function getTelegramSourcesCache(): Cache {
  if (!g.__telegramSourcesCache) {
    g.__telegramSourcesCache = createTelegramSourcesCache(async () => {
      const { supabaseAdmin } = await import("@/lib/db.server");
      const { data, error } = await supabaseAdmin
        .from("telegram_sources")
        .select("id, telegram_chat_id, telegram_thread_id")
        .eq("active", true);
      if (error) throw new Error(error.message);
      return data ?? [];
    });
  }
  return g.__telegramSourcesCache;
}
