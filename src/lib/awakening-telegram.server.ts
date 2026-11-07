import { readAwakeningScouting } from "./awakening.server";
import { routeScoutingMessage, type ScoutingMessage } from "./awakening-routing";
import { handleTextMessage, tgSend } from "./gvg-video-bot.server";

export function handleAwakeningMessage(message: ScoutingMessage) {
  return routeScoutingMessage(message, {
    handleInteractive: () => handleTextMessage(message.chatId, message.userId, message.text),
    read: readAwakeningScouting,
    // tgSend does not set parse_mode. User names cannot become HTML/Markdown.
    send: (text) => tgSend(message.chatId, message.threadId, text),
  });
}