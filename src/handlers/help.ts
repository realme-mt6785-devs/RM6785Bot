import { getLogger } from "@logtape/logtape";

import type { BotContext, HandlerDescriptor } from "../types";

import { replyToMessage } from "../utils/contextUtils";

const logger = getLogger(["RM6785Bot", "handlers", "help"]);

const helpHandler = async (ctx: BotContext) => {
  const { registeredCommands } = await import("../index");
  const commands = [...registeredCommands].sort(
    (a, b) => b.priority - a.priority,
  );

  logger.debug(`help: listing ${commands.length} commands`);

  const lines = commands.map(
    (command) => `${command.command} - ${command.description}`,
  );

  await replyToMessage(ctx, `Available commands:\n\n${lines.join("\n")}\n`);
};

const handler: HandlerDescriptor = {
  command: "help",
  help: "Get information about all available commands.",
  execute: helpHandler,
  priority: 100,
};

export { handler };
