import { supabaseAdmin } from "@/lib/db.server";
import type { TowerOrigin } from "@/lib/tower-origin";

const STATE_BUCKET = "defense-screenshots";
const STATE_PATH = "bot-state/tower-origins.json";

type OriginState = { origins: TowerOrigin[] };

async function readState(): Promise<OriginState> {
  try {
    // The Storage object endpoint is CDN-cached, so a plain download can return
    // a stale file right after a write (a freshly added tower would then show
    // up in the list without its source link). Fetch a signed URL with a
    // cache-busting query and no-store so the read is always current.
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(STATE_BUCKET)
      .createSignedUrl(STATE_PATH, 60);
    if (signError || !signed?.signedUrl) return { origins: [] };
    const response = await fetch(`${signed.signedUrl}&_=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!response.ok) return { origins: [] };
    const parsed = (await response.json()) as OriginState;
    return { origins: Array.isArray(parsed.origins) ? parsed.origins : [] };
  } catch {
    return { origins: [] };
  }
}

async function writeState(state: OriginState): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(STATE_PATH, new Blob([JSON.stringify(state)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
      cacheControl: "0",
    });
  if (error) throw new Error(`Tower origin state write failed: ${error.message}`);
}

export async function listTowerOrigins(): Promise<TowerOrigin[]> {
  return (await readState()).origins;
}

export async function saveTowerOrigin(origin: TowerOrigin, overwrite = true): Promise<void> {
  const state = await readState();
  const existing = state.origins.find((item) => item.tower_id === origin.tower_id);
  if (existing && !overwrite) return;
  await writeState({
    origins: [...state.origins.filter((item) => item.tower_id !== origin.tower_id), origin],
  });
}

export async function deleteTowerOrigin(towerId: string): Promise<TowerOrigin | null> {
  const state = await readState();
  const existing = state.origins.find((item) => item.tower_id === towerId) ?? null;
  if (!existing) return null;
  await writeState({ origins: state.origins.filter((item) => item.tower_id !== towerId) });
  return existing;
}
