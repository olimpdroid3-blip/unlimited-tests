import { battlePowerRepository } from "@/lib/battle-power-ui";
import {
  createLocalStorageMobCatalogRepository,
  createLocalStorageMobLevelsRepository,
  type PlayerOption,
} from "@/lib/mob-levels";
import { testMobCatalog, testPlayerMobLevels } from "@/lib/test-player-data";

const testMobCatalogSource = {
  async getAll() {
    return [...testMobCatalog];
  },
};

export const mobLevelsRepository = createLocalStorageMobLevelsRepository(
  undefined,
  testPlayerMobLevels,
);
export const mobCatalogRepository = createLocalStorageMobCatalogRepository(testMobCatalogSource);

export async function loadMobLevelPlayers(): Promise<PlayerOption[]> {
  return (await battlePowerRepository.getAll()).map(({ id, nickname }) => ({ id, nickname }));
}
