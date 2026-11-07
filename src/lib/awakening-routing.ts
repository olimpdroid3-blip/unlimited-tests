import { formatScoutingReply, scoutingRequestPosition, type ScoutingResult } from "./awakening.ts";

export type ScoutingMessage = { chatId: number; threadId: number | null; userId: number; text: string; formHandled: boolean };
export async function routeScoutingMessage(message: ScoutingMessage, io: {
  handleInteractive: () => Promise<boolean>;
  read: (position: string) => Promise<ScoutingResult>;
  send: (text: string) => Promise<unknown>;
}): Promise<boolean> {
  const position = scoutingRequestPosition(message.chatId, message.threadId, message.text, message.formHandled);
  if (!position || !Number.isSafeInteger(message.userId) || message.userId <= 0) return false;
  // Tower/walkthrough routing already ran. Preserve video hero/note form ownership too.
  if (await io.handleInteractive()) return true;
  let reply: string;
  try {
    const result = await io.read(position);
    reply = formatScoutingReply(position, result.reports.find((report) => report.tower_position === position));
  } catch {
    reply = "Не вдалося завантажити розвідку. Спробуйте ще раз пізніше.";
  }
  await io.send(reply);
  return true;
}