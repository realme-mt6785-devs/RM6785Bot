import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { parsePostAndConstructRichMarkdown } from "../utils/postParser";

const logger = getLogger(["RM6785Bot", "handlers", "lintrich"]);

const lintHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const replyMsg = ctx.message.reply_to_message;

  if (!("caption" in replyMsg) || !replyMsg.caption) {
    logger.debug(
      `lintrich: no caption/banner on replied message=${replyMsg.message_id}`,
    );
    await ctx.bot.sendRichMessage(
      ctx.message.chat.id,
      {
        markdown:
          "# ERROR: No ROM banner was found. Please provide a banner for the ROM.",
      },
      {
        reply_parameters: { message_id: replyMsg.message_id },
      },
    );
    return;
  }

  const result = parsePostAndConstructRichMarkdown(
    ctx.message.reply_to_message,
  );
  const lintResultMarkdown = result !== undefined ? "# successful" : "# failed";

  logger.info(
    `lintrich: rich parse of message=${replyMsg.message_id} ${result !== undefined ? "succeeded" : "failed"}`,
  );

  await ctx.bot.sendRichMessage(
    ctx.message.chat.id,
    { markdown: lintResultMarkdown },
    {
      reply_parameters: { message_id: replyMsg.message_id },
    },
  );
};

const handler: HandlerDescriptor = {
  command: "lintrich",
  help: "Check if the rich parser is able to parse the post.",
  reply_to_message: true,
  execute: lintHandler,
};

export { handler };
