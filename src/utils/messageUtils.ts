import { getLogger } from "@logtape/logtape";

import { MAX_VOTES } from "../constants";

const logger = getLogger(["RM6785Bot", "utils", "messageUtils"]);

export interface MessageInfo {
  [userId: number]: boolean;
  isPosted?: boolean;
  stickerMessageId?: number | null;
  sentMessageId?: number | null;
  countdownMessageId?: number | null;
  timeoutId?: ReturnType<typeof setTimeout> | null;
}

export const messageInfo: Record<number, MessageInfo> = {};

export const hasUserVoted = (messageId: number, userId: number): boolean =>
  messageInfo[messageId]?.[userId] === true;

export const currentVotes = (messageId: number): number => {
  const info = messageInfo[messageId];
  if (!info) return 0;
  return Object.keys(info).filter((k) => /^\d+$/.test(k)).length;
};

export const hasEnoughVotes = (messageId: number): boolean => {
  const votes = currentVotes(messageId);
  const enough = votes >= MAX_VOTES;
  logger.debug(
    `hasEnoughVotes: message=${messageId} votes=${votes}/${MAX_VOTES} enough=${enough}`,
  );
  return enough;
};
