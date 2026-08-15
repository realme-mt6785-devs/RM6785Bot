import { getLogger } from "@logtape/logtape";

import { MAX_VOTES } from "../constants";

const logger = getLogger(["RM6785Bot", "utils", "messageUtils"]);

export interface PostState {
  votes: Set<number>;
  isPosted: boolean;
  stickerMessageId: number | null;
  countdownMessageId: number | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

const postStates = new Map<number, PostState>();

export const getPostState = (messageId: number): PostState => {
  const existing = postStates.get(messageId);
  if (existing) return existing;

  const created: PostState = {
    votes: new Set(),
    isPosted: false,
    stickerMessageId: null,
    countdownMessageId: null,
    timeoutId: null,
  };

  postStates.set(messageId, created);
  return created;
};

export const peekPostState = (messageId: number): PostState | undefined =>
  postStates.get(messageId);

export const resetSchedule = (messageId: number): void => {
  const state = postStates.get(messageId);
  if (!state) return;

  if (state.timeoutId) clearTimeout(state.timeoutId);

  state.isPosted = false;
  state.stickerMessageId = null;
  state.countdownMessageId = null;
  state.timeoutId = null;
};

export const hasUserVoted = (messageId: number, userId: number): boolean =>
  postStates.get(messageId)?.votes.has(userId) === true;

export const currentVotes = (messageId: number): number =>
  postStates.get(messageId)?.votes.size ?? 0;

export const hasEnoughVotes = (messageId: number): boolean => {
  const votes = currentVotes(messageId);
  const enough = votes >= MAX_VOTES;
  logger.debug(
    `hasEnoughVotes: message=${messageId} votes=${votes}/${MAX_VOTES} enough=${enough}`,
  );
  return enough;
};

export const recordVote = (messageId: number, userId: number): number => {
  const state = getPostState(messageId);
  state.votes.add(userId);
  logger.debug(
    `recordVote: message=${messageId} user=${userId} votes=${state.votes.size}/${MAX_VOTES}`,
  );
  return state.votes.size;
};
