import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { parseTimeout, schedulePost } from "../utils/postScheduler";
import { postStrategy } from "./post";

const logger = getLogger(["RM6785Bot", "handlers", "fpost"]);

const fpostHandler = async (ctx: BotContext) => {
  const target = ctx.message.reply_to_message;
  if (!target) return;

  logger.info(
    `fpost: force-posting message=${target.message_id}, bypassing the approval gate`,
  );

  await schedulePost(ctx, postStrategy, parseTimeout(ctx.message.text), {
    force: true,
  });
};

const handler: HandlerDescriptor = {
  command: "fpost",
  help: "Publish a message on the channel without waiting for approvals.",
  su: true,
  reply_to_message: true,
  execute: fpostHandler,
};

export { handler };
