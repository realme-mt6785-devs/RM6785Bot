import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { removeAuthorizedUser } from "../utils/authUtils";
import { replyToMessage } from "../utils/contextUtils";

const logger = getLogger(["RM6785Bot", "handlers", "rmauth"]);

const rmauthHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const replyMsg = ctx.message.reply_to_message;
  if (!replyMsg.from) return;

  const user = replyMsg.from;
  logger.info(`rmauth: attempting to remove user id=${user.id}`);
  const removed = await removeAuthorizedUser(user.id);

  if (removed) {
    logger.info(`rmauth: removed user id=${user.id}`);
    await replyToMessage(
      ctx,
      `@${user.username || user.first_name} has been removed from the authorized users.`,
    );
  } else {
    logger.debug(`rmauth: user id=${user.id} not in authorized list`);
    await replyToMessage(ctx, "This user is not in the authorized users list.");
  }
};

const handler: HandlerDescriptor = {
  command: "rmauth",
  help: "Unauthorize a user from using the /post command.",
  su: true,
  reply_to_message: true,
  execute: rmauthHandler,
};

export { handler };
