import type TelegramBot from "node-telegram-bot-api";
import type { Chat } from "node-telegram-bot-api";

import { getLogger } from "@logtape/logtape";

import type { BotContext } from "./types";

import {
  MAX_REQUESTS,
  REQUEST_TIMEOUT,
  TELEGRAM_RELEASE_CHAT,
} from "./constants";
import { runLint } from "./handlers/lint";
import { formatAuthorizedUserList } from "./utils/authUtils";
import { sendRichReply } from "./utils/contextUtils";
import lintTelegramPost from "./utils/lintUtils";
import { updateUserRequest } from "./utils/userRequestUtils";

const logger = getLogger(["RM6785Bot", "autoPostDetection"]);

const isPublicSupergroup = (chat: Chat): boolean =>
  chat.type === "supergroup" && Boolean(chat.username);

const handlePrivatePost = async (ctx: BotContext) => {
  const msg = ctx.message;
  const [lintResult, lintSuccessful] = lintTelegramPost(
    msg.caption!,
    msg.caption_entities ?? [],
  );

  logger.info(
    `private post from chat=${msg.chat.id}: lint ${lintSuccessful ? "passed" : "failed"}`,
  );
  await sendRichReply(ctx, msg.message_id, lintResult);

  if (!lintSuccessful) return;

  const userRequests = updateUserRequest(msg.chat.id);
  if (userRequests > MAX_REQUESTS) {
    logger.warn(
      `spam detected from chat=${msg.chat.id} (${userRequests}/${MAX_REQUESTS} requests)`,
    );
    await ctx.bot.sendMessage(
      msg.chat.id,
      `Spam detected, Try again after ${REQUEST_TIMEOUT / 60000} minutes`,
    );
    return;
  }

  logger.info(
    `forwarding post message=${msg.message_id} from chat=${msg.chat.id} to release chat for approval`,
  );
  await ctx.bot.forwardMessage(
    TELEGRAM_RELEASE_CHAT,
    msg.chat.id,
    msg.message_id,
  );
  await sendRichReply(
    ctx,
    msg.message_id,
    "Forwarded post in the group for approval",
  );
  await ctx.bot.sendMessage(
    TELEGRAM_RELEASE_CHAT,
    await formatAuthorizedUserList(),
    { parse_mode: "Markdown" },
  );
};

const setupAutoPostDetection = (bot: TelegramBot, botInfo: { id: number }) => {
  bot.on("message", async (msg) => {
    try {
      if (isPublicSupergroup(msg.chat)) return;
      if (!msg.caption) return;
      if (!msg.caption.includes("#ROM") && !msg.caption.includes("#KERNEL")) {
        return;
      }

      logger.info(
        `detected post in chat=${msg.chat.id} (${msg.chat.type}) message=${msg.message_id}`,
      );

      const ctx: BotContext = { bot, botInfo, message: msg };

      if (msg.chat.type === "private") {
        await handlePrivatePost(ctx);
        return;
      }

      logger.debug(
        `running lint on post message=${msg.message_id} in chat=${msg.chat.id}`,
      );
      await runLint(ctx, msg);
    } catch (error) {
      logger.error(
        `autoPostDetection failed for message=${msg.message_id} in chat=${msg.chat.id}: ${(error as Error).message}`,
      );
    }
  });
};

export default setupAutoPostDetection;
