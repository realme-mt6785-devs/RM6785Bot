import type { BotContext, HandlerDescriptor } from "../types";
import { replyToMessage } from "../utils/contextUtils";
import { getLogger } from "@logtape/logtape";

const logger = getLogger(["RM6785Bot", "handlers", "help"]);

const helpHandler = async (ctx: BotContext) => {
  const { registeredCommands } = await import("../index");
  registeredCommands.sort((a, b) => b.priority - a.priority);
  logger.debug(`help: listing ${registeredCommands.length} commands`);
  let helpMessage = "Available commands:\n\n";

  registeredCommands.forEach((command) => {
    helpMessage += `${command.command} - ${command.description}\n`;
  });
  await replyToMessage(ctx, helpMessage);
};

const handler: HandlerDescriptor = {
  command: "help",
  help: "Get information about all available commands.",
  execute: helpHandler,
  priority: 100,
};

export { handler };
