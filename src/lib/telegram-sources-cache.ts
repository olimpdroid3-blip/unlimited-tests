// Cache of active telegram_sources, scoped to one warm server instance.
// Request-driven TTL (no timers): refresh when stale, single-flight, forced
// refresh on miss, keep last good snapshot on refresh errors.

export const TELEGRAM_SOURCES_TTL_MS = 60_000;

export type SourceRow = {
  id: string;
  telegram_chat_id: number | string;
  telegram_thread_id: number | string | null;
};

export type SourceLoader = () => Promise<SourceRow[]>;

/** Exact pair key; thread defaults to 0, matching the previous `threadId ?? 0` query. */
export function sourceKey(chatId: number | string, threadId: number | string | null | undefined) {
  return `${String(chatId)}:${String(threadId ?? 0)}`;
}

export function createTelegramSourcesCache(
  loader: SourceLoader,
  options: { ttlMs?: number; now?: () => number } = {},
) {
  const ttlMs = options.ttlMs ?? TELEGRAM_SOURCES_TTL_MS;
  const now = options.now ?? Date.now;
  let index: Map<string, string> | null = null;
  let loadedAt = 0;
  let inflight: Promise<void> | null = null;

  function refresh(): Promise<void> {
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const rows = await loader();
        const next = new Map<string, string>();
        for (const row of rows) next.set(sourceKey(row.telegram_chat_id, row.telegram_thread_id), row.id);
        index = next; // atomic swap only after success
        loadedAt = now();
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  /** Returns the source id, null if not allowed. Throws only if no good cache ever existed. */
  async function findSource(
    chatId: number | string,
    threadId: number | string | null | undefined,
  ): Promise<string | null> {
    const key = sourceKey(chatId, threadId);
    if (!index || now() - loadedAt >= ttlMs) {
      try {
        await refresh();
      } catch (error) {
        if (!index) throw error;
        console.error("[telegram-sources-cache] refresh failed, using last good cache", errMsg(error));
      }
    }
    const hit = index!.get(key);
    if (hit) return hit;
    // Miss: one forced refresh so newly added sources are visible immediately.
    try {
      await refresh();
    } catch (error) {
      console.error("[telegram-sources-cache] forced refresh failed", errMsg(error));
      return null;
    }
    return index!.get(key) ?? null;
  }

  return { findSource, refresh };
}

function errMsg(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
