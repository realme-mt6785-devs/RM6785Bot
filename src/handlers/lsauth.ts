import type { BotContext, HandlerDescriptor } from "../types";

import { formatAuthorizedUserList } from "../utils/authUtils";

const lsauthHandler = async (ctx: BotContext) => {
  await ctx.bot.sendMessage(
    ctx.message.chat.id,
    await formatAuthorizedUserList(),
    { parse_mode: "Markdown" },
  );
};

const handler: HandlerDescriptor = {
  command: "lsauth",
  help: "List all authorized users who can post messages on the channel.",
  execute: lsauthHandler,
};

export { handler };
