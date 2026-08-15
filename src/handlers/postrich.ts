import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { TELEGRAM_RM6785_CHANNEL } from "../constants";
import { replyToMessage } from "../utils/contextUtils";
import { parsePostAndConstructRichMarkdown } from "../utils/postParser";
import {
  parseTimeout,
  schedulePost,
  type PostStrategy,
} from "../utils/postScheduler";

const logger = getLogger(["RM6785Bot", "handlers", "postrich"]);

const countdownMarkdown = (remaining: string) =>
  `# Something incoming! Scheduled in ${remaining}`;

const createPostrichStrategy = (richMarkdown: string): PostStrategy => ({
  name: "postrich",

  sendCountdown: async (ctx, totalMinutes) => {
    const sent = await ctx.bot.sendRichMessage(TELEGRAM_RM6785_CHANNEL, {
      markdown: countdownMarkdown(`$$${totalMinutes}$$m`),
    });
    return sent.message_id;
  },

  editCountdown: async (ctx, countdownMessageId, minutes, seconds) => {
    await ctx.bot.editMessageText({
      chat_id: TELEGRAM_RM6785_CHANNEL,
      message_id: countdownMessageId,
      rich_message: {
        markdown: countdownMarkdown(`$$${minutes}$$m $$${seconds}$$s`),
      },
    });
  },

  publish: async (ctx, countdownMessageId) => {
    await ctx.bot.deleteMessage(TELEGRAM_RM6785_CHANNEL, countdownMessageId);

    const published = await ctx.bot.sendRichMessage(TELEGRAM_RM6785_CHANNEL, {
      markdown: richMarkdown,
    });

    return published.message_id;
  },
});

const postrichHandler = async (ctx: BotContext) => {
  const target = ctx.message.reply_to_message;
  if (!target || !ctx.message.text) return;

  const args = ctx.message.text.split(" ");
  if (args.length < 3) {
    logger.debug("postrich: not enough args provided");
    await replyToMessage(ctx, "Usage: /postrich <time e.g. 5m> <banner url>");
    return;
  }

  const bannerLink = args[2];
  const richMarkdown = parsePostAndConstructRichMarkdown(target, bannerLink);

  if (!richMarkdown) {
    logger.warn(
      `postrich: could not parse message=${target.message_id} into rich markdown`,
    );
    await replyToMessage(
      ctx,
      "Could not parse this post into rich markdown. Run /lintrich on it to check.",
    );
    return;
  }

  logger.debug(
    `postrich: parsed message=${target.message_id}, banner=${bannerLink}`,
  );

  await schedulePost(
    ctx,
    createPostrichStrategy(richMarkdown),
    parseTimeout(args[1]),
  );
};

const handler: HandlerDescriptor = {
  command: "postrich",
  help: "Publish an approved message on the channel.",
  auth: true,
  reply_to_message: true,
  execute: postrichHandler,
};

export { handler };
