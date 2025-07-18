// bot.js
import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes,
} from "discord.js";
import { logger } from "./utils/logger.js";
import { mapvoteCommand } from "./commands/mapvote.js";

// 1. Création du client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

client.commands = new Collection();
client.commands.set(mapvoteCommand.data.name, mapvoteCommand);

// 2. Enregistrer les slash commands à Discord (au démarrage)
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);
  try {
    logger.info("Enregistrement des commandes slash...");
    await rest.put(Routes.applicationCommands(process.env.APP_ID), {
      body: [mapvoteCommand.data.toJSON()],
    });
    logger.success("✅ Commandes slash enregistrées");
  } catch (err) {
    logger.error("❌ Erreur en enregistrant les commandes", {
      error: err.message,
    });
  }
}

// 3. Lancer le bot
client.once("ready", () => {
  logger.success(`🤖 Connecté en tant que ${client.user.tag}`);
});

// 4. Gestion des interactions
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`❌ Erreur dans la commande ${interaction.commandName}`, {
      error: err.message,
    });
    await interaction.reply({
      content: "Erreur lors de l'exécution de la commande.",
      ephemeral: true,
    });
  }
});

// 5. Démarrer
await registerCommands();
await client.login(process.env.BOT_TOKEN);
