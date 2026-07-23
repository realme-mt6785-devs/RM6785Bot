import type TelegramBot from "node-telegram-bot-api";

import { getLogger } from "@logtape/logtape";

import type { BotContext } from "./types";

import {
  TELEGRAM_RELEASE_CHAT,
  MAX_REQUESTS,
  REQUEST_TIMEOUT,
} from "./constants";
import { handler as lintHandler } from "./handlers/lint";
import { handler as lsauthHandler } from "./handlers/lsauth";
import { replyToMessage } from "./utils/contextUtils";
import lintTelegramPost from "./utils/lintUtils";
import { updateUserRequest } from "./utils/userRequestUtils";

const logger = getLogger(["RM6785Bot", "autoPostDetection"]);

const setupAutoPostDetection = (bot: TelegramBot, botInfo: { id: number }) => {
  bot.on("message", async (msg) => {
    if (
      msg.chat.type === "supergroup" &&
      "username" in msg.chat &&
      msg.chat.username
    ) {
      return;
    }

    if (!msg.caption) return;

    if (
      msg.caption.search("#ROM") !== -1 ||
      msg.caption.search("#KERNEL") !== -1
    ) {
      logger.info(
        `detected post in chat=${msg.chat.id} (${msg.chat.type}) message=${msg.message_id}`,
      );
      const replyMsg = {
        message_id: msg.message_id,
        date: msg.date,
        chat: msg.chat,
        caption: msg.caption,
        caption_entities: msg.caption_entities,
      };

      msg.reply_to_message = replyMsg as any;

      const ctx: BotContext = { bot, botInfo, message: msg };

      if (msg.chat.type === "private") {
        const [lintResult, lintSuccessful] = lintTelegramPost(
          replyMsg.caption!,
          (replyMsg as any).caption_entities ?? [],
        );
        logger.info(
          `private post from chat=${msg.chat.id}: lint ${lintSuccessful ? "passed" : "failed"}`,
        );
        await bot.sendRichMessage(
          msg.chat.id,
          { markdown: lintResult },
          {
            reply_parameters: { message_id: msg.message_id },
          },
        );
        if (lintSuccessful) {
          const userRequests = updateUserRequest(msg.chat.id);
          if (userRequests > MAX_REQUESTS) {
            logger.warn(
              `spam detected from chat=${msg.chat.id} (${userRequests}/${MAX_REQUESTS} requests)`,
            );
            await bot.sendMessage(
              msg.chat.id,
              `Spam detected, Try again after ${
                REQUEST_TIMEOUT / 60000
              } minutes`,
            );
            return;
          }

          logger.info(
            `forwarding post message=${msg.message_id} from chat=${msg.chat.id} to release chat for approval`,
          );
          await bot.forwardMessage(
            TELEGRAM_RELEASE_CHAT,
            msg.chat.id,
            msg.message_id,
          );
          await replyToMessage(ctx, "Forwarded post in the group for approval");
          const updatedCtx: BotContext = {
            ...ctx,
            message: {
              ...msg,
              chat: { ...msg.chat, id: TELEGRAM_RELEASE_CHAT },
            },
          };

          await lsauthHandler.execute(updatedCtx);
        }
      } else {
        logger.debug(
          `running lint handler on post message=${msg.message_id} in chat=${msg.chat.id}`,
        );
        const lintCtx: BotContext = {
          ...ctx,
          message: {
            ...msg,
            reply_to_message: msg.reply_to_message,
          },
        };
        await lintHandler.execute(lintCtx);
      }
    }
  });
};

export default setupAutoPostDetection;
