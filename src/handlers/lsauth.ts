import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { getAuthorizedUsers } from "../utils/authUtils";

const logger = getLogger(["RM6785Bot", "handlers", "lsauth"]);

const lsauthHandler = async (ctx: BotContext) => {
  const authorizedUsers = await getAuthorizedUsers();
  logger.info(`lsauth: listing ${authorizedUsers.length} authorized users`);
  let message = "Authorized users:\n";
  authorizedUsers.forEach((user) => {
    message += `[${user.name}](tg://user?id=${user.id})\n`;
  });
  await ctx.bot.sendMessage(ctx.message.chat.id, message, {
    parse_mode: "Markdown",
  });
};

const handler: HandlerDescriptor = {
  command: "lsauth",
  help: "List all authorized users who can post messages on the channel.",
  execute: lsauthHandler,
};

export { handler };
