import type { BotContext, HandlerDescriptor } from "../types";
import { addAuthorizedUser } from "../utils/authUtils";
import { replyToMessage } from "../utils/contextUtils";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "handlers", "auth"]);

const authHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg.from) return;

  const user = replyMsg.from;
  logger.info(
    `auth: attempting to authorize user id=${user.id} username=@${user.username ?? user.first_name}`
  );
  const authorized = await addAuthorizedUser({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
  });

  if (authorized) {
    logger.info(`auth: authorized user id=${user.id}`);
    await replyToMessage(
      ctx,
      `@${user.username || user.first_name} has been authorized to use the bot.`
    );
  } else {
    logger.debug(`auth: user id=${user.id} already authorized`);
    await replyToMessage(ctx, "This user is already authorized.");
  }
};

const handler: HandlerDescriptor = {
  command: "auth",
  help: "Authorize a user to review and post messages to channel.",
  su: true,
  reply_to_message: true,
  execute: authHandler,
};

export { handler };
