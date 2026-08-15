import { getLogger } from "@logtape/logtape";

import type { BotContext } from "../types";

import {
  COUNTDOWN_EDIT_EVERY,
  COUNTDOWN_TICK,
  MAX_VOTES,
  POST_TIMEOUT,
  TELEGRAM_R7_CHAT,
  TELEGRAM_RM6785_CHANNEL,
  TELEGRAM_RM6785_CHAT,
  TELEGRAM_STICKER_FILE_ID,
  TEST_MODE,
} from "../constants";
import { replyToMessage } from "./contextUtils";
import {
  currentVotes,
  getPostState,
  hasEnoughVotes,
  resetSchedule,
} from "./messageUtils";

const logger = getLogger(["RM6785Bot", "utils", "postScheduler"]);

const FORWARD_TARGETS = [TELEGRAM_RM6785_CHAT, TELEGRAM_R7_CHAT];

export interface PostStrategy {
  name: string;
  sendCountdown: (ctx: BotContext, totalMinutes: number) => Promise<number>;
  editCountdown: (
    ctx: BotContext,
    countdownMessageId: number,
    minutes: number,
    seconds: number,
  ) => Promise<void>;
  publish: (ctx: BotContext, countdownMessageId: number) => Promise<number>;
}

export const parseTimeout = (text: string | undefined): number => {
  const match = text?.match(/\d+(\.\d+)?m/);
  if (!match) return POST_TIMEOUT;

  return parseFloat(match[0].replace(/m$/, "")) * 60000;
};

export const schedulePost = async (
  ctx: BotContext,
  strategy: PostStrategy,
  timeoutInMs: number,
  options: { force?: boolean } = {},
): Promise<void> => {
  const replyTo = ctx.message.reply_to_message;
  if (!replyTo) return;

  const chatId = ctx.message.chat.id;
  const messageId = replyTo.message_id;
  const totalMinutes = timeoutInMs / 60000;
  const votes = currentVotes(messageId);

  logger.info(
    `${strategy.name}: requested for message=${messageId} votes=${votes}/${MAX_VOTES} timeout=${totalMinutes}m force=${options.force === true} testMode=${TEST_MODE}`,
  );

  const state = getPostState(messageId);

  if (state.isPosted) {
    logger.warn(
      `${strategy.name}: message=${messageId} already scheduled, ignoring`,
    );
    await replyToMessage(
      ctx,
      "This message has already been scheduled for posting.",
    );
    return;
  }

  if (!TEST_MODE && !options.force && !hasEnoughVotes(messageId)) {
    logger.info(
      `${strategy.name}: message=${messageId} lacks approvals (${votes}/${MAX_VOTES}), rejecting`,
    );
    await replyToMessage(
      ctx,
      `This message does not have enough approvals (${votes}/${MAX_VOTES})`,
    );
    return;
  }

  state.isPosted = true;

  let stickerMessageId: number;
  let countdownMessageId: number;
  let progressMessageId: number;

  try {
    const sticker = await ctx.bot.sendSticker(
      TELEGRAM_RM6785_CHANNEL,
      TELEGRAM_STICKER_FILE_ID,
    );
    stickerMessageId = sticker.message_id;
    countdownMessageId = await strategy.sendCountdown(ctx, totalMinutes);

    state.stickerMessageId = stickerMessageId;
    state.countdownMessageId = countdownMessageId;

    logger.debug(
      `${strategy.name}: sent sticker=${stickerMessageId} countdown=${countdownMessageId} for message=${messageId}`,
    );

    const progress = await replyToMessage(
      ctx,
      `Scheduled to post in ${totalMinutes}m`,
    );
    progressMessageId = progress.message_id;
  } catch (error) {
    resetSchedule(messageId);
    logger.error(
      `${strategy.name}: failed to schedule message=${messageId}: ${(error as Error).message}`,
    );
    return;
  }

  const editProgress = (text: string) =>
    ctx.bot.editMessageText({
      chat_id: chatId,
      message_id: progressMessageId,
      text,
    });

  const showRemaining = async (secondsLeft: number) => {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;

    const results = await Promise.allSettled([
      editProgress(`Scheduled to post in ${minutes}m ${seconds}s`),
      strategy.editCountdown(ctx, countdownMessageId, minutes, seconds),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn(
          `${strategy.name}: countdown edit failed for message=${messageId}: ${(result.reason as Error).message}`,
        );
      }
    }
  };

  const abandon = async (error: Error) => {
    resetSchedule(messageId);
    logger.error(
      `${strategy.name}: failed to publish message=${messageId}: ${error.message}`,
    );

    await Promise.allSettled([
      ctx.bot.deleteMessages(TELEGRAM_RM6785_CHANNEL, [
        stickerMessageId,
        countdownMessageId,
      ]),
      editProgress(`Failed to post: ${error.message}`),
    ]);
  };

  const publish = async () => {
    logger.info(
      `${strategy.name}: countdown elapsed, publishing message=${messageId}`,
    );

    const publishedMessageId = await strategy.publish(ctx, countdownMessageId);

    // the post is live from here on, so nothing below may undo it by throwing
    resetSchedule(messageId);

    try {
      await editProgress("Posted successfully!");
    } catch (error) {
      logger.warn(
        `${strategy.name}: could not update the progress message for message=${messageId}: ${(error as Error).message}`,
      );
    }

    try {
      for (const target of FORWARD_TARGETS) {
        const forwarded = await ctx.bot.forwardMessage(
          target,
          TELEGRAM_RM6785_CHANNEL,
          publishedMessageId,
        );
        await ctx.bot.pinChatMessage(target, forwarded.message_id);
        logger.debug(
          `${strategy.name}: forwarded+pinned message to chat=${target}`,
        );
      }
      logger.info(
        `${strategy.name}: message=${messageId} published and pinned`,
      );
    } catch (error) {
      logger.error(
        `${strategy.name}: failed to forward/pin message=${messageId}: ${(error as Error).message}`,
      );
    }
  };

  let secondsLeft = Math.floor(timeoutInMs / 1000);

  const runTick = async (): Promise<void> => {
    try {
      if (secondsLeft % COUNTDOWN_EDIT_EVERY === 0) {
        await showRemaining(secondsLeft);
      }

      if (secondsLeft > 0) {
        secondsLeft -= 1;
        state.timeoutId = setTimeout(() => void runTick(), COUNTDOWN_TICK);
        return;
      }

      await publish();
    } catch (error) {
      try {
        await abandon(
          error instanceof Error ? error : new Error(String(error)),
        );
      } catch (cleanupError) {
        logger.error(
          `${strategy.name}: cleanup for message=${messageId} failed: ${(cleanupError as Error).message}`,
        );
      }
    }
  };

  state.timeoutId = setTimeout(() => void runTick(), COUNTDOWN_TICK);
};
