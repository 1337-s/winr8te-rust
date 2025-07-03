import "dotenv/config";
import express from "express";
import { verifyKeyMiddleware } from "discord-interactions";
import { handleInteraction } from "./handlers/interactionHandler.js";
import { logger } from "./utils/logger.js";
import { startDiscordClient } from "./utils/discord.js"; // Importer la fonction qui démarre Discord

const app = express();
const PORT = process.env.PORT;

app.post(
  "/interactions",
  verifyKeyMiddleware(process.env.PUBLIC_KEY),
  handleInteraction
);

app.listen(PORT, async () => {
  logger.success("Server started", { port: PORT });
  logger.info("Environment check", {
    publicKeyConfigured: !!process.env.PUBLIC_KEY,
    botTokenConfigured: !!process.env.BOT_TOKEN,
    appIdConfigured: !!process.env.APP_ID,
  });

  try {
    await startDiscordClient(); // Lancer le client Discord
    logger.info("Bot Discord connecté et prêt");
  } catch (err) {
    logger.error("Erreur lors du démarrage du bot Discord", {
      error: err.message,
    });
  }
});
