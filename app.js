import "dotenv/config";
import express from "express";
import { verifyKeyMiddleware } from "discord-interactions";
import { handleInteraction } from "./handlers/interactionHandler.js";
import { logger } from "./utils/logger.js";

// Create an express app
const app = express();
const PORT = process.env.PORT;

/**
 * Endpoint principal pour les interactions Discord
 */
app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  handleInteraction
);

// Start server
app.listen(PORT, () => {
  logger.success("Server started", { port: PORT });
  logger.info("Environment check", {
    publicKeyConfigured: !!process.env.PUBLIC_KEY,
    botTokenConfigured: !!process.env.BOT_TOKEN,
    appIdConfigured: !!process.env.APP_ID,
  });

  logger.info("Bot is ready");
});
