import { getLogger } from "@logtape/logtape";
import { InputMediaPhoto, Message } from "node-telegram-bot-api";

import type { BotContext, HandlerDescriptor } from "../types";

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
import {
  messageInfo,
  hasEnoughVotes,
  currentVotes,
} from "../utils/messageUtils";

const logger = getLogger(["RM6785Bot", "handlers", "post"]);

const postHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message || !ctx.message.text) return;

  const chatId = ctx.message.chat.id;
  const messageId = ctx.message.reply_to_message.message_id;
  const votes = currentVotes(messageId);
  const timeoutMatch = ctx.message.text?.match(/\d+(\.\d+)?m/);
  let timeoutInMs = POST_TIMEOUT;
  if (timeoutMatch) {
    const timeoutInMinutes = parseFloat(timeoutMatch[0].replace(/m$/, ""));
    timeoutInMs = timeoutInMinutes * 60000;
  }

  logger.info(
    `post: requested for message=${messageId} votes=${votes}/${MAX_VOTES} timeout=${timeoutInMs / 60000}m testMode=${TEST_MODE}`,
  );

  if (!messageInfo[messageId]) {
    messageInfo[messageId] = {};
  }

  const msg = messageInfo[messageId];

  if (msg.isPosted) {
    logger.warn(`post: message=${messageId} already scheduled, ignoring`);
    await replyToMessage(
      ctx,
      "This message has already been scheduled for posting.",
    );
    return;
  }

  if (!TEST_MODE && !hasEnoughVotes(messageId)) {
    logger.info(
      `post: message=${messageId} lacks approvals (${votes}/${MAX_VOTES}), rejecting`,
    );
    await replyToMessage(
      ctx,
      `This message does not have enough approvals (${votes}/${MAX_VOTES})`,
    );
    return;
  }

  msg.isPosted = true;

  try {
    const sentSticker = await ctx.bot.sendSticker(
      TELEGRAM_RM6785_CHANNEL,
      TELEGRAM_STICKER_FILE_ID,
    );
    const countdown = await ctx.bot.sendMessage(
      TELEGRAM_RM6785_CHANNEL,
      `Something incoming! Scheduled in <b>${timeoutInMs / 60000}m</b>`,
      {
        parse_mode: "html",
      },
    );

    msg.stickerMessageId = sentSticker.message_id;
    msg.countdownMessageId = countdown.message_id;

    logger.debug(
      `post: sent sticker=${sentSticker.message_id} countdown=${countdown.message_id} for message=${messageId}`,
    );

    const sentMessage = await replyToMessage(
      ctx,
      `Scheduled to post in ${timeoutInMs / 60000}m`,
    );
    const sentMessageId = sentMessage.message_id;

    let secondsLeft = Math.floor(timeoutInMs / 1000);

    const countdownTimeout = async () => {
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
          message_id: countdown.message_id,
          text: `Something incoming! Scheduled in <b>${minutes}m ${seconds}s</b>`,
          parse_mode: "html",
        });
        await Promise.all([a, b]);
      }

      if (secondsLeft <= 0) {
        logger.info(`post: countdown elapsed, publishing message=${messageId}`);
        const editedCountdown = (await ctx.bot.editMessageMedia(
          {
            type: "photo",
            media: ctx.message.reply_to_message!.photo![0].file_id,
            caption: ctx.message.reply_to_message!.caption!,
            caption_entities: ctx.message.reply_to_message!.caption_entities!,
          } as InputMediaPhoto,
          {
            chat_id: TELEGRAM_RM6785_CHANNEL,
            message_id: countdown.message_id,
          },
        )) as Message;

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
              editedCountdown.message_id,
            );
            await ctx.bot.pinChatMessage(toChat, forwardedMsg.message_id);
            logger.debug(
              `post: forwarded+pinned message from chat=${fromChat} to chat=${toChat}`,
            );
          };

          await forwardAndPin(TELEGRAM_RM6785_CHANNEL, TELEGRAM_RM6785_CHAT);
          await forwardAndPin(TELEGRAM_RM6785_CHANNEL, TELEGRAM_R7_CHAT);
          logger.info(`post: message=${messageId} published and pinned`);
        } catch (error) {
          logger.error(
            `post: failed to forward/pin message=${messageId}: ${(error as Error).message}`,
          );
        }
      } else {
        msg.timeoutId = setTimeout(countdownTimeout, 1000);
      }

      secondsLeft -= 1;
    };

    const timeoutId = setTimeout(countdownTimeout, 1000);
    msg.timeoutId = timeoutId;
  } catch (error) {
    logger.error(
      `post: failed to schedule message=${messageId}: ${(error as Error).message}`,
    );
  }
};

const handler: HandlerDescriptor = {
  command: "post",
  help: "Publish an approved message on the channel.",
  auth: true,
  reply_to_message: true,
  execute: postHandler,
};

export { handler };
