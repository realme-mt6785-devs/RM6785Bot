import { getLogger } from "@logtape/logtape";
import { Octokit } from "@octokit/rest";
import { spawn } from "node:child_process";
import simpleGit from "simple-git";

import { GH_REPO_TOKEN } from "./config";
import { bot } from "./index";

const logger = getLogger(["RM6785Bot", "ci"]);

const git = simpleGit();
const octokit = new Octokit({ auth: GH_REPO_TOKEN });

let latestRemoteCommit: string;
let latestCommitMessage: string;
let latestCommitUrl: string;

const pullChanges = () =>
  git.fetch("origin", "master").then(() => git.checkout("origin/master"));

const restartBot = async () => {
  const chatId = "-1001801695556";

  try {
    logger.info(
      `restarting bot for commit ${latestRemoteCommit.substring(0, 7)}: ${latestCommitMessage}`,
    );
    await pullChanges();

    await bot.sendMessage(
      chatId,
      `<a href="${latestCommitUrl}">${latestRemoteCommit.substring(
        0,
        7,
      )}</a>: ${latestCommitMessage}\n\nRestarting the bot`,
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
    await bot.sendMessage(chatId, `Failed to restart bot: ${err.message}`);
  }
};

const commitListener = async () => {
  try {
    const { data: remoteCommits } = await octokit.repos.listCommits({
      owner: "SamarV-121",
      repo: "RM6785Bot",
    });

    if (remoteCommits?.length > 0) {
      latestRemoteCommit = remoteCommits[0].sha;
      latestCommitMessage = remoteCommits[0].commit.message;
      latestCommitUrl = remoteCommits[0].html_url;

      const localCommitHead = await git.revparse(["HEAD"]);

      if (latestRemoteCommit !== localCommitHead) {
        logger.info(
          `new remote commit detected ${latestRemoteCommit.substring(0, 7)} (local ${localCommitHead.substring(0, 7)}): ${latestCommitMessage}`,
        );
        restartBot();
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error(`Failed to fetch remote commits: ${err.message}`);
  }
};

export default commitListener;
