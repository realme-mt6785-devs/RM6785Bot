const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const flagFromEnv = (name: string): boolean => {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
};

export const MAX_VOTES = 3;
export const MAX_REQUESTS = 2;
export const POST_TIMEOUT = 5 * 60 * 1000;
export const REQUEST_TIMEOUT = 10 * 60 * 1000;
export const COUNTDOWN_TICK = 1000;
export const COUNTDOWN_EDIT_EVERY = 5;
export const CI_POLL_INTERVAL = 5000;
export const CI_REPO_OWNER = "SamarV-121";
export const CI_REPO_NAME = "RM6785Bot";
export const TELEGRAM_STICKER_FILE_ID =
  "CAACAgUAAxkBAAIX12Rci3DXLH_h_hjgvbkmM6YSMEhUAAIvBAAC3gABcVWicSZoSZsiti8E";
export const TELEGRAM_RM6785_CHANNEL = intFromEnv(
  "TELEGRAM_RM6785_CHANNEL",
  -1001384382397,
);
export const TELEGRAM_RM6785_CHAT = intFromEnv(
  "TELEGRAM_RM6785_CHAT",
  -1001754321934,
);
export const TELEGRAM_R7_CHAT = -1001167300698;
export const TELEGRAM_TESTING_CHAT = -1001801695556;
export const TELEGRAM_RELEASE_CHAT = -1001299514785;
export const TELEGRAM_SU_ID = [1138003186, 1583181351, 1024853832];
export const TEST_MODE = flagFromEnv("TEST_MODE");
