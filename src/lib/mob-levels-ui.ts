import { battlePowerRepository } from "@/lib/battle-power-ui";
import { supabase } from "@/lib/db";
import { type PlayerOption } from "@/lib/mob-levels";
import {
  createSupabaseMobCatalogRepository,
  createSupabaseMobLevelsRepository,
  type MobLevelsGateway,
} from "@/lib/mob-levels-supabase";

const supabaseMobLevelsGateway: MobLevelsGateway = {
  async listMobs() {
    const { data, error } = await supabase.from("mobs").select("id,name,image_url").order("id");
    if (error) throw error;
    return data;
  },

  async updateMobNames(inputs) {
    return Promise.all(
      inputs.map(async ({ id, name }) => {
        const { data, error } = await supabase
          .from("mobs")
          .update({ name })
          .eq("id", id)
          .select("id,name,image_url")
          .single();
        if (error) throw error;
        return data;
      }),
    );
  },

  async listPlayerLevels(playerId) {
    const { data, error } = await supabase
      .from("player_mob_levels")
      .select("player_id,mob_id,level,updated_at")
      .eq("player_id", playerId)
      .order("mob_id");
    if (error) throw error;
    return data;
  },

  async upsertPlayerLevels(inputs) {
    const { data, error } = await supabase
      .from("player_mob_levels")
      .upsert(inputs, { onConflict: "player_id,mob_id" })
      .select("player_id,mob_id,level,updated_at");
    if (error) throw error;
    return data;
  },

  async deletePlayerLevel(playerId, mobId) {
    const { error } = await supabase
      .from("player_mob_levels")
      .delete()
      .eq("player_id", playerId)
      .eq("mob_id", mobId);
    if (error) throw error;
  },
};

export const mobLevelsRepository = createSupabaseMobLevelsRepository(supabaseMobLevelsGateway);
export const mobCatalogRepository = createSupabaseMobCatalogRepository(supabaseMobLevelsGateway);

export async function loadMobLevelPlayers(): Promise<PlayerOption[]> {
  return (await battlePowerRepository.getAll()).map(({ id, nickname }) => ({ id, nickname }));
}
