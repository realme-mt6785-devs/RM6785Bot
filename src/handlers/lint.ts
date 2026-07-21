import type { BotContext, HandlerDescriptor } from "../types";
import lintTelegramPost from "../utils/lintUtils";
import { handler as voteHandler } from "./vote";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "handlers", "lint"]);

const lintHandler = async (ctx: BotContext) => {
  if (!ctx.message.reply_to_message) return;

  const replyMsg = ctx.message.reply_to_message;

  if (!("caption" in replyMsg) || !replyMsg.caption) {
    logger.debug(
      `lint: no caption/banner on replied message=${replyMsg.message_id}`
    );
    await ctx.bot.sendRichMessage(
      ctx.message.chat.id,
      {
        markdown:
          "# ERROR: No ROM banner was found. Please provide a banner for the ROM.",
      },
      {
        reply_parameters: { message_id: replyMsg.message_id },
      }
    );
    return;
  }

  const [lintResult, lintSuccessful] = lintTelegramPost(
    replyMsg.caption,
    "caption_entities" in replyMsg
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((replyMsg as any).caption_entities ?? [])
      : []
  );

  logger.info(
    `lint: message=${replyMsg.message_id} lint ${lintSuccessful ? "passed" : "failed"}`
  );

  await ctx.bot.sendRichMessage(
    ctx.message.chat.id,
    { markdown: lintResult },
    {
      reply_parameters: { message_id: replyMsg.message_id },
    }
  );

  if (lintSuccessful) {
    logger.debug(
      `lint: auto-casting bot vote for message=${replyMsg.message_id}`
    );
    const voteCommandCtx: BotContext = {
      ...ctx,
      message: {
        ...ctx.message,
        from: { ...ctx.message.from!, id: ctx.botInfo.id },
      },
    };

    await voteHandler.execute(voteCommandCtx);
  }
};

const handler: HandlerDescriptor = {
  command: "lint",
  help: "Check the formatting and style of a post.",
  reply_to_message: true,
  execute: lintHandler,
};

export { handler };
