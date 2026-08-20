import { supabase } from "@/lib/db";
import { createBattlePowerRepository, type BattlePowerRemoteSource } from "@/lib/battle-power";
import { testBattlePowerRows } from "@/lib/test-player-data";

const battlePowerColumns = "id,nickname,power1,power2,power3,power4,power5";

const supabaseBattlePowerSource: BattlePowerRemoteSource = {
  async getAll() {
    const { data, error } = await supabase.from("battle_power").select(battlePowerColumns);
    if (error) throw error;
    return data ?? [];
  },

  async create(input) {
    const { data, error } = await supabase
      .from("battle_power")
      .insert(input)
      .select(battlePowerColumns)
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, input) {
    const { data, error } = await supabase
      .from("battle_power")
      .update(input)
      .eq("id", id)
      .select(battlePowerColumns)
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from("battle_power").delete().eq("id", id);
    if (error) throw error;
  },
};

export const battlePowerRepository = createBattlePowerRepository(
  supabaseBattlePowerSource,
  testBattlePowerRows,
);
