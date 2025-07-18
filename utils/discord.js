import { Client, GatewayIntentBits } from "discord.js";
import { logger } from "./logger.js";
import {
  initializeAntispam,
  handleMessage,
  handleMemberJoin,
} from "./antispam.js";

let client;

// Configuration des intents
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
];

// Fonction pour démarrer le client Discord
export async function startDiscordClient() {
  try {
    client = new Client({ intents });

    // Événement ready
    client.on("ready", async () => {
      logger.success("Discord client ready", {
        tag: client.user.tag,
        guilds: client.guilds.cache.size,
      });

      // Initialisation du système antispam
      await initializeAntispam();
    });

    // Événement messageCreate (pour l'antispam)
    client.on("messageCreate", async (message) => {
      try {
        await handleMessage(message, client);
      } catch (error) {
        logger.error("Error handling message", {
          messageId: message.id,
          error: error.message,
        });
      }
    });

    // Événement guildMemberAdd (pour l'antispam)
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

    // Gestion des erreurs
    client.on("error", (error) => {
      logger.error("Discord client error", { error: error.message });
    });

    // Connexion
    await client.login(process.env.BOT_TOKEN);
  } catch (error) {
    logger.error("Failed to start Discord client", { error: error.message });
    throw error;
  }
}

// Fonction pour obtenir le client Discord
export function getDiscordClient() {
  return client;
}

// Fonction pour installer les commandes globales (gardé de votre code original)
export async function InstallGlobalCommands(appId, commands) {
  const endpoint = `applications/${appId}/commands`;

  try {
    const response = await fetch(`https://discord.com/api/v10/${endpoint}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    logger.success("Global commands installed", { count: data.length });

    return data;
  } catch (error) {
    logger.error("Failed to install global commands", { error: error.message });
    throw error;
  }
}

export const activeVotes = new Map();
