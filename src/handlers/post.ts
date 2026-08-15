import { getLogger } from "@logtape/logtape";
import { InputMediaPhoto, Message, PhotoSize } from "node-telegram-bot-api";

import type { BotContext, HandlerDescriptor } from "../types";

import { TELEGRAM_RM6785_CHANNEL } from "../constants";
import {
  parseTimeout,
  schedulePost,
  type PostStrategy,
} from "../utils/postScheduler";

const logger = getLogger(["RM6785Bot", "handlers", "post"]);

const largestPhoto = (sizes: PhotoSize[]): PhotoSize =>
  sizes.reduce((largest, size) =>
    size.width * size.height > largest.width * largest.height ? size : largest,
  );

const countdownText = (remaining: string) =>
  `Something incoming! Scheduled in <b>${remaining}</b>`;

const publishAsPhoto = async (
  ctx: BotContext,
  target: Message,
  countdownMessageId: number,
): Promise<number> => {
  const banner = largestPhoto(target.photo!);

  logger.debug(
    `post: editing the countdown into a ${banner.width}x${banner.height} photo post`,
  );

  const published = (await ctx.bot.editMessageMedia(
    {
      type: "photo",
      media: banner.file_id,
      caption: target.caption!,
      caption_entities: target.caption_entities!,
    } as InputMediaPhoto,
    {
      chat_id: TELEGRAM_RM6785_CHANNEL,
      message_id: countdownMessageId,
    },
  )) as Message;

  return published.message_id;
};

export const postStrategy: PostStrategy = {
  name: "post",

  sendCountdown: async (ctx, totalMinutes) => {
    const sent = await ctx.bot.sendMessage(
      TELEGRAM_RM6785_CHANNEL,
      countdownText(`${totalMinutes}m`),
      { parse_mode: "html" },
    );
    return sent.message_id;
  },

  editCountdown: async (ctx, countdownMessageId, minutes, seconds) => {
    await ctx.bot.editMessageText({
      chat_id: TELEGRAM_RM6785_CHANNEL,
      message_id: countdownMessageId,
      text: countdownText(`${minutes}m ${seconds}s`),
      parse_mode: "html",
    });
  },

  publish: async (ctx, countdownMessageId) =>
    publishAsPhoto(ctx, ctx.message.reply_to_message!, countdownMessageId),
};

const postHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message || !ctx.message.text) return;

  await schedulePost(ctx, postStrategy, parseTimeout(ctx.message.text));
};

const handler: HandlerDescriptor = {
  command: "post",
  help: "Publish an approved message on the channel.",
  auth: true,
  reply_to_message: true,
  execute: postHandler,
};

export { handler };
