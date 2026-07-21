import { REQUEST_TIMEOUT } from "../constants";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "utils", "userRequestUtils"]);

const trackUserRequests = new Map<number, number>();

export const updateUserRequest = (userId: number): number => {
  const currentCount = trackUserRequests.get(userId);

  if (currentCount !== undefined) {
    const newCount = currentCount + 1;
    trackUserRequests.set(userId, newCount);
    logger.debug(`updateUserRequest: user=${userId} count=${newCount}`);
    return newCount;
  }

  trackUserRequests.set(userId, 1);
  logger.debug(`updateUserRequest: user=${userId} count=1 (new window)`);
  setTimeout(() => {
    trackUserRequests.delete(userId);
    logger.debug(
      `updateUserRequest: cleared request window for user=${userId}`
    );
  }, REQUEST_TIMEOUT);
  return 1;
};
