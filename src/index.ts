import type { Message } from "node-telegram-bot-api";

import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { prettyFormatter } from "@logtape/pretty";
import TelegramBot from "node-telegram-bot-api";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { BotContext, HandlerDescriptor, RegisteredCommand } from "./types";

import setupAutoPostDetection from "./autoPostDetection";
import { BOT_TOKEN } from "./config";
import { CI_POLL_INTERVAL, TEST_MODE } from "./constants";
import * as Middleware from "./middlewares";
import { replyToMessage } from "./utils/contextUtils";

const __dirname = dirname(fileURLToPath(import.meta.url));
const argv = yargs(hideBin(process.argv))
  .option("ci", {
    type: "boolean",
    default: false,
    describe: "Watch the remote repository and restart on new commits",
  })
  .parseSync();

await configure({
  sinks: { console: getConsoleSink({ formatter: prettyFormatter }) },
  loggers: [
    {
      category: ["logtape", "meta"],
      lowestLevel: "fatal",
      sinks: ["console"],
    },
    {
      category: ["RM6785Bot"],
      lowestLevel: "debug",
      sinks: ["console"],
    },
    {
      category: ["dependency"],
      lowestLevel: "debug",
      sinks: ["console"],
    },
  ],
});

const logger = getLogger(["RM6785Bot"]);

process.on("unhandledRejection", (reason) => {
  logger.error(
    `unhandled rejection: ${reason instanceof Error ? reason.stack : String(reason)}`,
  );
});

process.on("uncaughtException", (error) => {
  logger.error(`uncaught exception: ${error.stack ?? error.message}`);
});

export const bot = new TelegramBot(BOT_TOKEN, { polling: true });

bot.on("polling_error", (error: Error) => {
  logger.error(`polling error: ${error.message}`);
});

bot.on("error", (error: Error) => {
  logger.error(`bot error: ${error.message}`);
});

const me = await bot.getMe();
const botInfo = { id: me.id };

logger.info(`authenticated as bot id=${me.id} username=@${me.username}`);

if (TEST_MODE) {
  logger.warn(
    "TEST_MODE is enabled: the approval vote requirement is bypassed for every post",
  );
}

function compose(
  middlewares: Middleware.Middleware[],
): (ctx: BotContext) => Promise<void> {
  return async (ctx) => {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;
      if (i >= middlewares.length) return;
      await middlewares[i](ctx, () => dispatch(i + 1));
    }
    await dispatch(0);
  };
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const handlerFiles = readdirSync(`${__dirname}/handlers`).filter(
  (file) => file.endsWith(".ts") || file.endsWith(".js"),
);

export const registeredCommands: RegisteredCommand[] = [];

for (const handlerFile of handlerFiles) {
  const handlerModule = await import(`./handlers/${handlerFile}`);
  const handler = handlerModule.handler as HandlerDescriptor;

  const middlewares: Middleware.Middleware[] = [];

  if (handler.su) {
    middlewares.push(Middleware.suMiddleware);
  }

  if (handler.auth) {
    middlewares.push(Middleware.authMiddleware);
  }

  if (handler.reply_to_message) {
    middlewares.push(Middleware.replyToMessageMiddleware);
  }

  if (handler.require_data) {
    middlewares.push(Middleware.checkDataMiddleware);
  }

  const commandHandler = compose([
    ...middlewares,
    async (ctx) => {
      logger.info(
        `dispatching '${handler.command}' from user=${ctx.message.from?.id ?? "unknown"} chat=${ctx.message.chat.id}`,
      );
      await handler.execute(ctx);
      logger.debug(`handler '${handler.command}' completed`);
    },
  ]);

  const runCommand = async (message: Message) => {
    const ctx: BotContext = { bot, botInfo, message };

    try {
      await commandHandler(ctx);
    } catch (error) {
      logger.error(
        `handler '${handler.command}' threw: ${(error as Error).stack ?? (error as Error).message}`,
      );

      try {
        await replyToMessage(
          ctx,
          `Something went wrong while running that command: ${(error as Error).message}`,
        );
      } catch (replyError) {
        logger.error(
          `failed to report the error back to chat=${message.chat.id}: ${(replyError as Error).message}`,
        );
      }
    }
  };

  for (const command of handler.command.split(" or ")) {
    const isSymbolCommand = /[^\w\s]/.test(command);

    const pattern = isSymbolCommand
      ? new RegExp(`^${escapeRegExp(command)}(?:\\s.*)?$`)
      : new RegExp(`^/${command}(?:@\\w+)?(?:\\s.*)?$`);

    bot.onText(pattern, (msg) => void runCommand(msg));

    if (!isSymbolCommand) {
      registeredCommands.push({
        command: `/${command}`,
        description: handler.help,
        priority: handler.priority ?? 0,
      });
    }

    logger.info(`successfully registered '${command}' command`);
  }
}

try {
  await bot.setMyCommands(
    [...registeredCommands].sort((a, b) => b.priority - a.priority),
  );
  logger.info(`registered ${registeredCommands.length} slash commands`);
} catch (error) {
  logger.error(
    `failed to register the slash commands: ${(error as Error).message}`,
  );
}

bot.onText(/^\/start(?:@\w+)?(?:\s.*)?$/, (msg) => {
  const ctx: BotContext = { bot, botInfo, message: msg };
  void replyToMessage(
    ctx,
    "Hola, amigo. I'm RM6785Bot, specially created to handle posts on the RM6785 telegram channel.\nSpank /help to know more about me",
  ).catch((error: Error) => {
    logger.error(`failed to answer /start: ${error.message}`);
  });
});

setupAutoPostDetection(bot, botInfo);

if (argv.ci) {
  logger.info("Starting the bot with CI");
  const { default: commitListener } = await import("./ci");
  setInterval(() => void commitListener(), CI_POLL_INTERVAL);
}
