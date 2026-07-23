import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { MAX_VOTES } from "../constants";
import { replyToMessage } from "../utils/contextUtils";
import {
  hasUserVoted,
  hasEnoughVotes,
  currentVotes,
  messageInfo,
} from "../utils/messageUtils";

const logger = getLogger(["RM6785Bot", "handlers", "vote"]);

const voteHandler = async (ctx: BotContext) => {
  if (!ctx.message.from) return;
  if (!ctx.message.reply_to_message) return;

  const userId = ctx.message.from.id;
  const messageId = ctx.message.reply_to_message.message_id;

  logger.debug(`vote: user=${userId} on message=${messageId}`);

  if (hasUserVoted(messageId, userId)) {
    logger.info(`vote: user=${userId} already voted for message=${messageId}`);
    await replyToMessage(
      ctx,
      `User $${userId}$ has already voted for this message.`,
    );
    return;
  }

  if (hasEnoughVotes(messageId)) {
    logger.info(
      `vote: message=${messageId} already has enough approvals, rejecting vote from user=${userId}`,
    );
    await replyToMessage(
      ctx,
      "This post already has enough approvals.\n\n" +
        `$$${MAX_VOTES}/${MAX_VOTES}$$\n\n<aside>Approval Counts<cite>Vote Failed</cite></aside>`,
    );
    return;
  }

  if (!messageInfo[messageId]) {
    messageInfo[messageId] = {};
  }

  messageInfo[messageId][userId] = true;

  const votes = currentVotes(messageId);

  logger.info(
    `vote: recorded vote from user=${userId} on message=${messageId} (${votes}/${MAX_VOTES})`,
  );

  await replyToMessage(
    ctx,
    `$$${votes}/${MAX_VOTES}$$\n\n<aside>Approval Counts<cite>Vote Successful</cite></aside>`,
  );
};

const handler: HandlerDescriptor = {
  command: "approve or +1",
  help: "Approve a message to be posted on the channel.",
  auth: true,
  reply_to_message: true,
  execute: voteHandler,
};

export { handler };
