import { supabase } from "@/integrations/supabase/client";
import {
  createLocalStorageMobLevelsRepository,
  emptyMobCatalogRepository,
  sortPlayerOptions,
  type PlayerOption,
} from "@/lib/mob-levels";

export const mobLevelsRepository = createLocalStorageMobLevelsRepository();
export const mobCatalogRepository = emptyMobCatalogRepository;

export async function loadMobLevelPlayers(): Promise<PlayerOption[]> {
  const { data, error } = await supabase.from("battle_power").select("id,nickname");
  if (error) throw error;
  return sortPlayerOptions(data ?? []);
}
