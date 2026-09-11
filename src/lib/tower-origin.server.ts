import { supabaseAdmin } from "@/lib/db.server";
import type { TowerOrigin } from "@/lib/tower-origin";

const STATE_BUCKET = "defense-screenshots";
const STATE_PATH = "bot-state/tower-origins.json";

type OriginState = { origins: TowerOrigin[] };

async function readState(): Promise<OriginState> {
  try {
    // Read through the authenticated Storage API instead of its CDN. The list
    // is regenerated immediately after a write and must see the new origin.
    const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).download(STATE_PATH);
    if (error || !data) return { origins: [] };
    const parsed = JSON.parse(await data.text()) as OriginState;
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
