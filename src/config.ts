import dotenv from "dotenv";

dotenv.config();

const required = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env or the shell environment.`,
    );
  }

  return value;
};

export const BOT_TOKEN = required("BOT_TOKEN");
export const GIST_ID = required("GIST_ID");
export const GIST_TOKEN = required("GIST_TOKEN");

export const requireGhRepoToken = (): string => required("GH_REPO_TOKEN");
