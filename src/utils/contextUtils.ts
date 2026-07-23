import type { Message, SendMessageParams } from "node-telegram-bot-api";

import { getLogger } from "@logtape/logtape";

import type { BotContext } from "../types";

const logger = getLogger(["RM6785Bot", "utils", "contextUtils"]);

export async function replyToMessage(
  ctx: BotContext,
  replyText: string,
  extra?: Omit<SendMessageParams, "chat_id" | "text">,
): Promise<Message> {
  const replyToMessageId =
    ctx.message.reply_to_message?.message_id || ctx.message.message_id;

  logger.debug(
    `replyToMessage: chat=${ctx.message.chat.id} replyTo=${replyToMessageId}`,
  );

  return ctx.bot.sendRichMessage(
    ctx.message.chat.id,
    { markdown: replyText },
    {
      ...extra,
      reply_parameters: { message_id: replyToMessageId },
    },
  );
}
