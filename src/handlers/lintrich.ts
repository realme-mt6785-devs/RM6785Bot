import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { replyToMessage } from "../utils/contextUtils";
import { NO_BANNER_ERROR } from "../utils/lintUtils";
import { parsePostAndConstructRichMarkdown } from "../utils/postParser";

const logger = getLogger(["RM6785Bot", "handlers", "lintrich"]);

const lintrichHandler = async (ctx: BotContext) => {
  const target = ctx.message.reply_to_message;
  if (!target) return;

  if (!target.caption) {
    logger.debug(`lintrich: no caption/banner on message=${target.message_id}`);
    await replyToMessage(ctx, NO_BANNER_ERROR);
    return;
  }

  const parsed = parsePostAndConstructRichMarkdown(target);

  logger.info(
    `lintrich: rich parse of message=${target.message_id} ${parsed !== undefined ? "succeeded" : "failed"}`,
  );

  await replyToMessage(ctx, parsed !== undefined ? "# successful" : "# failed");
};

const handler: HandlerDescriptor = {
  command: "lintrich",
  help: "Check if the rich parser is able to parse the post.",
  reply_to_message: true,
  execute: lintrichHandler,
};

export { handler };
