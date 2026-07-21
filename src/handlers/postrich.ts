import type { BotContext, HandlerDescriptor } from "../types";
import {
  messageInfo,
  hasEnoughVotes,
  currentVotes,
} from "../utils/messageUtils";
import {
  POST_TIMEOUT,
  MAX_VOTES,
  TELEGRAM_STICKER_FILE_ID,
  TELEGRAM_RM6785_CHANNEL,
  TELEGRAM_RM6785_CHAT,
  TELEGRAM_R7_CHAT,
  TEST_MODE,
} from "../constants";
import { replyToMessage } from "../utils/contextUtils";
import type { Message } from "node-telegram-bot-api";
import { parsePostAndConstructRichMarkdown } from "../utils/postParser";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "handlers", "postrich"]);

const postrichHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message || !ctx.message.text) return;

  const chatId = ctx.message.chat.id;
  const messageId = ctx.message.reply_to_message.message_id;
  const votes = currentVotes(messageId);
  const mText = ctx.message.text?.split(" ");
  if (mText.length < 3) {
    logger.debug("postrich: not enough args provided");
    await replyToMessage(ctx, "Not enough arg");
    return;
  }
  const timeoutMatch = mText[1].match(/\d+(\.\d+)?m/);
  let timeoutInMs = POST_TIMEOUT;
  if (timeoutMatch) {
    const timeoutInMinutes = parseFloat(timeoutMatch[0].replace(/m$/, ""));
    timeoutInMs = timeoutInMinutes * 60000;
  }
  const bannerLink = mText[2];

  logger.info(
    `postrich: requested for message=${messageId} votes=${votes}/${MAX_VOTES} timeout=${timeoutInMs / 60000}m banner=${bannerLink} testMode=${TEST_MODE}`
  );

  if (!messageInfo[messageId]) {
    messageInfo[messageId] = {};
  }

  const msg = messageInfo[messageId];

  if (msg.isPosted) {
    logger.warn(`postrich: message=${messageId} already scheduled, ignoring`);
    await replyToMessage(
      ctx,
      "This message has already been scheduled for posting."
    );
    return;
  }

  if (!TEST_MODE && !hasEnoughVotes(messageId)) {
    logger.info(
      `postrich: message=${messageId} lacks approvals (${votes}/${MAX_VOTES}), rejecting`
    );
    await replyToMessage(
      ctx,
      `This message does not have enough approvals (${votes}/${MAX_VOTES})`
    );
    return;
  }

  msg.isPosted = true;

  try {
    const sentStickerPromise = ctx.bot.sendSticker(
      TELEGRAM_RM6785_CHANNEL,
      TELEGRAM_STICKER_FILE_ID
    );
    const richCountdownPromise = ctx.bot.sendRichMessage(
      TELEGRAM_RM6785_CHANNEL,
      {
        markdown: `# Something incoming! Scheduled in $$${timeoutInMs / 60000}$$m`,
      }
    );

    const [sentSticker, richCountdown] = await Promise.all([
      sentStickerPromise,
      richCountdownPromise,
    ]);

    msg.stickerMessageId = sentSticker.message_id;
    msg.countdownMessageId = richCountdown.message_id;

    logger.debug(
      `postrich: sent sticker=${sentSticker.message_id} countdown=${richCountdown.message_id} for message=${messageId}`
    );

    const sentMessage = await replyToMessage(
      ctx,
      `Scheduled to post in ${timeoutInMs / 60000}m`
    );
    const sentMessageId = sentMessage.message_id;

    let secondsLeft = Math.floor(timeoutInMs / 1000);

    const countdownTimeout = async (m: Message) => {
      if (secondsLeft % 5 === 0) {
        const minutes = Math.floor(secondsLeft / 60);
        const seconds = secondsLeft % 60;
        const a = ctx.bot.editMessageText({
          chat_id: chatId,
          message_id: sentMessageId,
          text: `Scheduled to post in ${minutes}m ${seconds}s`,
        });
        const b = ctx.bot.editMessageText({
          chat_id: TELEGRAM_RM6785_CHANNEL,
          message_id: richCountdown.message_id,
          rich_message: {
            markdown: `# Something incoming! Scheduled in $$${minutes}$$m $$${seconds}$$s`,
          },
        });
        await Promise.all([a, b]);
      }

      if (secondsLeft <= 0) {
        logger.info(
          `postrich: countdown elapsed, publishing message=${messageId}`
        );
        const richMarkdown = parsePostAndConstructRichMarkdown(m, bannerLink);
        if (!richMarkdown) {
          logger.error(
            `postrich: failed to parse rich markdown for message=${messageId}, aborting publish`
          );
          return;
        }

        await ctx.bot.deleteMessage(
          TELEGRAM_RM6785_CHANNEL,
          richCountdown.message_id
        );
        const sentPostMessage = await ctx.bot.sendRichMessage(
          TELEGRAM_RM6785_CHANNEL,
          {
            markdown: richMarkdown,
          }
        );

        msg.isPosted = false;

        await ctx.bot.editMessageText({
          chat_id: chatId,
          message_id: sentMessageId,
          text: "Posted successfully!",
        });

        try {
          const forwardAndPin = async (fromChat: number, toChat: number) => {
            const forwardedMsg = await ctx.bot.forwardMessage(
              toChat,
              fromChat,
              sentPostMessage.message_id
            );
            await ctx.bot.pinChatMessage(toChat, forwardedMsg.message_id);
            logger.debug(
              `postrich: forwarded+pinned message from chat=${fromChat} to chat=${toChat}`
            );
          };

          await forwardAndPin(TELEGRAM_RM6785_CHANNEL, TELEGRAM_RM6785_CHAT);
          await forwardAndPin(TELEGRAM_RM6785_CHANNEL, TELEGRAM_R7_CHAT);
          logger.info(`postrich: message=${messageId} published and pinned`);
        } catch (error) {
          logger.error(
            `postrich: failed to forward/pin message=${messageId}: ${(error as Error).message}`
          );
        }
      } else {
        msg.timeoutId = setTimeout(
          countdownTimeout,
          1000,
          ctx.message.reply_to_message!
        );
      }

      secondsLeft -= 1;
    };

    const timeoutId = setTimeout(
      countdownTimeout,
      1000,
      ctx.message.reply_to_message!
    );
    msg.timeoutId = timeoutId;
  } catch (error) {
    logger.error(
      `postrich: failed to schedule message=${messageId}: ${(error as Error).message}`
    );
  }
};

const handler: HandlerDescriptor = {
  command: "postrich",
  help: "Publish an approved message on the channel.",
  auth: true,
  reply_to_message: true,
  execute: postrichHandler,
};

export { handler };
