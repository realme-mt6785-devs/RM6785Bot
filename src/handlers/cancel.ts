import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { TELEGRAM_RM6785_CHANNEL } from "../constants";
import { replyToMessage } from "../utils/contextUtils";
import { peekPostState, resetSchedule } from "../utils/messageUtils";

const logger = getLogger(["RM6785Bot", "handlers", "cancel"]);

const cancelHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const messageId = ctx.message.reply_to_message.message_id;
  const state = peekPostState(messageId);

  if (
    !state?.isPosted ||
    state.stickerMessageId === null ||
    state.countdownMessageId === null
  ) {
    logger.debug(`cancel: no active schedule for message=${messageId}`);
    await replyToMessage(ctx, "No scheduled post found to cancel.");
    return;
  }

  logger.info(`cancel: cancelling scheduled post for message=${messageId}`);

  const { stickerMessageId, countdownMessageId } = state;
  resetSchedule(messageId);

  try {
    await ctx.bot.deleteMessages(TELEGRAM_RM6785_CHANNEL, [
      stickerMessageId,
      countdownMessageId,
    ]);

    logger.info(`cancel: scheduled post cancelled for message=${messageId}`);
    await replyToMessage(ctx, "Successfully cancelled the scheduled post.");
  } catch (error) {
    logger.error(
      `cancel: failed to remove channel messages for message=${messageId}: ${(error as Error).message}`,
    );
    await replyToMessage(
      ctx,
      "Stopped the countdown, but failed to remove the channel messages.",
    );
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
