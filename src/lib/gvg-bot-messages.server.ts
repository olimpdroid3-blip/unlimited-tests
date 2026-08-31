// Tracks bot message ids in the towers topic so the "/+" command can delete
// all previous bot messages after posting a fresh list.
import { supabaseAdmin } from "@/lib/db.server";

const STATE_BUCKET = "defense-screenshots";
const STATE_PATH = "bot-state/bot-messages.json";

export type BotMessageKind = "tower" | "mirror" | "list";

type TrackedMessage = { message_id: number; kind: BotMessageKind; at: string };
type State = { messages: TrackedMessage[] };

async function readState(): Promise<State> {
  const { data, error } = await supabaseAdmin.storage.from(STATE_BUCKET).download(STATE_PATH);
  if (error || !data) return { messages: [] };
  try {
    const parsed = JSON.parse(await data.text()) as State;
    return { messages: Array.isArray(parsed.messages) ? parsed.messages : [] };
  } catch {
    return { messages: [] };
  }
}

async function writeState(state: State): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STATE_BUCKET)
    .upload(STATE_PATH, new Blob([JSON.stringify(state)], { type: "application/json" }), {
      upsert: true,
      contentType: "application/json",
    });
  if (error) console.error("[bot-messages] state write failed", error.message);
}

export async function trackBotMessage(messageId: number, kind: BotMessageKind): Promise<void> {
  const state = await readState();
  state.messages = state.messages.filter((m) => m.message_id !== messageId);
  state.messages.push({ message_id: messageId, kind, at: new Date().toISOString() });
  await writeState(state);
}

/** Returns tracked ids and clears the list except for the ids in `keep`. */
export async function drainBotMessages(keep: number[] = []): Promise<number[]> {
  const state = await readState();
  const keepSet = new Set(keep);
  const toDelete = state.messages.filter((m) => !keepSet.has(m.message_id)).map((m) => m.message_id);
  const remaining = state.messages.filter((m) => keepSet.has(m.message_id));
  await writeState({ messages: remaining });
  return toDelete;
}
