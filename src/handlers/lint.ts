import type { Message } from "node-telegram-bot-api";

import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { sendRichReply } from "../utils/contextUtils";
import lintTelegramPost, { NO_BANNER_ERROR } from "../utils/lintUtils";
import { castVote } from "./vote";

const logger = getLogger(["RM6785Bot", "handlers", "lint"]);

export const runLint = async (
  ctx: BotContext,
  target: Message,
): Promise<boolean> => {
  if (!target.caption) {
    logger.debug(`lint: no caption/banner on message=${target.message_id}`);
    await sendRichReply(ctx, target.message_id, NO_BANNER_ERROR);
    return false;
  }

  const [lintResult, lintSuccessful] = lintTelegramPost(
    target.caption,
    target.caption_entities ?? [],
  );

  logger.info(
    `lint: message=${target.message_id} lint ${lintSuccessful ? "passed" : "failed"}`,
  );

  await sendRichReply(ctx, target.message_id, lintResult);

  if (lintSuccessful) {
    logger.debug(
      `lint: auto-casting bot vote for message=${target.message_id}`,
    );
    await castVote(ctx, target.message_id, ctx.botInfo.id);
  }

  return lintSuccessful;
};

const lintHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  await runLint(ctx, ctx.message.reply_to_message);
};

const handler: HandlerDescriptor = {
  command: "lint",
  help: "Check the formatting and style of a post.",
  reply_to_message: true,
  execute: lintHandler,
};

export { handler };
