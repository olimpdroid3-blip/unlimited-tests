import { supabaseAdmin } from "@/lib/db.server";
import { executeAwakeningReset, parseScoutingPosition, type AwakeningRpc, type ScoutingResult } from "./awakening";

// Local cast only: the external deployed RPCs are newer than generated DB types.
type RpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> };
const rpc: AwakeningRpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabaseAdmin as unknown as RpcClient).rpc(name, args);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("EMPTY_RPC_RESULT");
  return data as T;
};

export async function readAwakeningScouting(position: string | null = null): Promise<ScoutingResult> {
  if (position !== null && parseScoutingPosition(position) !== position) throw new Error("INVALID_POSITION");
  return rpc<ScoutingResult>("awakening_read", { p_scope: "nonameclan", p_position: position });
}

export async function clearAwakeningTowers() {
  return executeAwakeningReset(rpc, async (paths) => {
    const { error } = await supabaseAdmin.storage.from("defense-screenshots").remove(paths);
    if (error) {
      console.warn("[awakening] postcommit screenshot cleanup failed");
      throw new Error("STORAGE_CLEANUP_FAILED");
    }
  });
}