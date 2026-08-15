import { getLogger } from "@logtape/logtape";
import { Octokit } from "@octokit/rest";
import { spawn } from "node:child_process";
import simpleGit from "simple-git";

import { requireGhRepoToken } from "./config";
import {
  CI_REPO_NAME,
  CI_REPO_OWNER,
  TELEGRAM_TESTING_CHAT,
} from "./constants";
import { bot } from "./index";

const logger = getLogger(["RM6785Bot", "ci"]);

const git = simpleGit();
const octokit = new Octokit({ auth: requireGhRepoToken() });

interface RemoteCommit {
  sha: string;
  message: string;
  url: string;
}

let checkInProgress = false;

const pullChanges = () =>
  git.fetch("origin", "master").then(() => git.checkout("origin/master"));

const restartBot = async (commit: RemoteCommit) => {
  const shortSha = commit.sha.substring(0, 7);

  try {
    logger.info(`restarting bot for commit ${shortSha}: ${commit.message}`);
    await pullChanges();

    await bot.sendMessage(
      TELEGRAM_TESTING_CHAT,
      `<a href="${commit.url}">${shortSha}</a>: ${commit.message}\n\nRestarting the bot`,
      { parse_mode: "HTML" },
    );

    const child = spawn("bun", ["run", "src/index.ts", "--", "--ci"], {
      stdio: "inherit",
      detached: true,
    });
    child.unref();
    process.exit(0);
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to restart bot: ${err.message}`);
    await bot.sendMessage(
      TELEGRAM_TESTING_CHAT,
      `Failed to restart bot: ${err.message}`,
    );
  }
};

const commitListener = async () => {
  if (checkInProgress) {
    logger.debug("commitListener: previous check still running, skipping");
    return;
  }

  checkInProgress = true;

  try {
    const { data: remoteCommits } = await octokit.repos.listCommits({
      owner: CI_REPO_OWNER,
      repo: CI_REPO_NAME,
    });

    const latest = remoteCommits?.[0];
    if (!latest) return;

    const localCommitHead = await git.revparse(["HEAD"]);
    if (latest.sha === localCommitHead) return;

    logger.info(
      `new remote commit detected ${latest.sha.substring(0, 7)} (local ${localCommitHead.substring(0, 7)}): ${latest.commit.message}`,
    );

    await restartBot({
      sha: latest.sha,
      message: latest.commit.message,
      url: latest.html_url,
    });
  } catch (error) {
    logger.error(`Failed to fetch remote commits: ${(error as Error).message}`);
  } finally {
    checkInProgress = false;
  }
};

export default commitListener;
