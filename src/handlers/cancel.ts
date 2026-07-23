import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { TELEGRAM_RM6785_CHANNEL } from "../constants";
import { replyToMessage } from "../utils/contextUtils";
import { messageInfo } from "../utils/messageUtils";

const logger = getLogger(["RM6785Bot", "handlers", "cancel"]);

const cancelHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const messageId = ctx.message.reply_to_message.message_id;
  const msg = messageInfo[messageId];

  if (msg?.stickerMessageId && msg?.countdownMessageId) {
    logger.info(`cancel: cancelling scheduled post for message=${messageId}`);
    clearTimeout(msg.timeoutId as ReturnType<typeof setTimeout>);

    try {
      await ctx.bot.deleteMessages(TELEGRAM_RM6785_CHANNEL, [
        msg.stickerMessageId,
        msg.countdownMessageId,
      ]);
      msg.isPosted = false;
      msg.stickerMessageId = null;
      msg.sentMessageId = null;
      msg.timeoutId = null;

      logger.info(`cancel: scheduled post cancelled for message=${messageId}`);
      await replyToMessage(ctx, "Successfully cancelled the scheduled post.");
    } catch (error) {
      logger.error(
        `cancel: failed to cancel message=${messageId}: ${(error as Error).message}`,
      );
      await replyToMessage(ctx, "Failed to cancel the scheduled post.");
    }
  } else {
    logger.debug(`cancel: no scheduled post found for message=${messageId}`);
    await replyToMessage(ctx, "No scheduled post found to cancel.");
  }
};

const handler: HandlerDescriptor = {
  command: "cancel",
  help: "Cancel a scheduled post. Please reply to the post you want to cancel.",
  auth: true,
  reply_to_message: true,
  execute: cancelHandler,
};

export { handler };
