import { getLogger } from "@logtape/logtape";
import type { BotContext } from "./types";
import { isAuthorized } from "./utils/authUtils";
import { TELEGRAM_SU_ID } from "./constants";
import { replyToMessage } from "./utils/contextUtils";

const logger = getLogger(["RM6785Bot", "middlewares"]);

export type Middleware = (
  ctx: BotContext,
  next: () => Promise<void>
) => Promise<void>;

export const suMiddleware: Middleware = async (ctx, next) => {
  const userId = ctx.message.from?.id;

  if (!userId || !TELEGRAM_SU_ID.includes(userId)) {
    logger.warn(`suMiddleware: rejected non-su user id=${userId ?? "unknown"}`);
    await replyToMessage(ctx, "You are not authorized to use this command.");
    return;
  }

  logger.debug(`suMiddleware: allowed su user id=${userId}`);
  return next();
};

export const authMiddleware: Middleware = async (ctx, next) => {
  if (!ctx.message.from) {
    logger.debug("authMiddleware: message has no sender, skipping");
    return;
  }

  const userId = ctx.message.from.id;
  const userAuthorized = await isAuthorized(userId);

  if (!userAuthorized) {
    logger.warn(`authMiddleware: rejected unauthorized user id=${userId}`);
    await replyToMessage(ctx, "You are not authorized to use this command.");
    return;
  }

  logger.debug(`authMiddleware: allowed authorized user id=${userId}`);
  return next();
};

export const replyToMessageMiddleware: Middleware = async (ctx, next) => {
  if (!ctx.message.reply_to_message) {
    logger.debug("replyToMessageMiddleware: no reply_to_message, rejecting");
    await replyToMessage(ctx, "Please reply to a message.");
    return;
  }

  return next();
};

export const checkDataMiddleware: Middleware = async (ctx, next) => {
  if (!ctx.message.text) return;

  const msgText = ctx.message.text.split(" ");

  if (!msgText[1]) {
    logger.debug("checkDataMiddleware: no data provided, rejecting");
    await replyToMessage(ctx, "No data is provided");
    return;
  }

  return next();
};
