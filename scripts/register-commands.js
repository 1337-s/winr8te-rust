import "dotenv/config";
import { commandDefinitions } from "../commands/index.js";
import { InstallGlobalCommands } from "../utils/discord.js";
import { logger } from "../utils/logger.js";

async function registerCommands() {
  logger.info("Starting command registration process");

  // Vérification des variables d'environnement
  if (!process.env.APP_ID || !process.env.BOT_TOKEN) {
    logger.error("Missing required environment variables (APP_ID, BOT_TOKEN)");
    process.exit(1);
  }

  logger.info("Commands to register", {
    count: commandDefinitions.length,
    commands: commandDefinitions.map((cmd) => cmd.name),
  });

  try {
    await InstallGlobalCommands(process.env.APP_ID, commandDefinitions);

    logger.success("All commands registered successfully!");
    logger.info(
      "Note: Global commands may take up to 1 hour to appear everywhere"
    );
  } catch (error) {
    logger.error("Failed to register commands", { error: error.message });
    process.exit(1);
  }
}

registerCommands();
