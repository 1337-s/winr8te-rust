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
import { handleReactionAdd, handleReactionRemove } from "./utils/reactions.js";
import { commands } from "./commands/index.js";

// 1. Création du client avec tous les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// 2. Configuration des commandes
client.commands = new Collection();
Object.entries(commands).forEach(([name, command]) => {
  client.commands.set(name, command);
});

// 3. Fonction pour enregistrer les commandes slash
async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

  try {
    logger.info("Enregistrement des commandes slash...");

    const commandsData = Array.from(client.commands.values())
      .map((command) => command.data?.toJSON() || command.definition)
      .filter(Boolean);

    await rest.put(Routes.applicationCommands(process.env.APP_ID), {
      body: commandsData,
    });

    logger.success("✅ Commandes slash enregistrées", {
      count: commandsData.length,
    });
  } catch (err) {
    logger.error("❌ Erreur en enregistrant les commandes", {
      error: err.message,
    });
  }
}

// 4. Événement ready
client.once("ready", async () => {
  logger.success(`🤖 Bot connecté en tant que ${client.user.tag}`);

  // Enregistrement des commandes
  await registerCommands();
});

// 5. Gestion des interactions (commandes slash)
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Utilisation de la méthode Discord.js standard
    if (command.execute) {
      await command.execute(interaction);
    }
  } catch (err) {
    logger.error(`❌ Erreur dans la commande ${interaction.commandName}`, {
      error: err.message,
    });

    const errorMsg = {
      content: "Erreur lors de l'exécution de la commande.",
      ephemeral: true,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMsg);
    } else {
      await interaction.reply(errorMsg);
    }
  }
});

// 7. Gestion des nouveaux membres
client.on("guildMemberAdd", async (member) => {
  try {
    await handleMemberJoin(member);
  } catch (error) {
    logger.error("Error handling member join", {
      userId: member.id,
      error: error.message,
    });
  }
});

// 8. Gestion des réactions (pour le mapvote)
client.on("messageReactionAdd", async (reaction, user) => {
  try {
    await handleReactionAdd(reaction, user, client);
  } catch (error) {
    logger.error("Error handling reaction add", {
      error: error.message,
    });
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  try {
    await handleReactionRemove(reaction, user, client);
  } catch (error) {
    logger.error("Error handling reaction remove", {
      error: error.message,
    });
  }
});

// 9. Gestion des erreurs
client.on("error", (error) => {
  logger.error("Discord client error", { error: error.message });
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", { promise, reason });
});

// 10. Démarrage du bot
client.login(process.env.BOT_TOKEN);

// Export du client pour les autres modules
export { client };
