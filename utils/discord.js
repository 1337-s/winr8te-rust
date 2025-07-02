import "dotenv/config";
import { logger } from "./logger.js";
import { Client, GatewayIntentBits } from "discord.js";

export async function DiscordRequest(endpoint, options) {
  const url = "https://discord.com/api/v10/" + endpoint;

  logger.debug("Making Discord API request", {
    url,
    method: options.method || "GET",
  });

  // Stringify payloads
  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  // Use fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.BOT_TOKEN}`,
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "DiscordBot (WINR8TE-Bot, 1.0.0)",
    },
    ...options,
  });

  // Gérer le cas où Discord nous rate limit
  if (res.status === 429) {
    const data = await res.json();
    const retryAfter = data.retry_after || 1;

    logger.warn("Rate limited by Discord API", {
      retryAfter,
      global: data.global || false,
    });

    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));

    // 🔁 Refaire la requête après le délai
    return await DiscordRequest(endpoint, options);
  }

  // Gérer les autres erreurs
  if (!res.ok) {
    const data = await res.json();
    logger.error("Discord API Error", {
      status: res.status,
      statusText: res.statusText,
      data,
    });
    throw new Error(`Discord API Error: ${res.status} ${JSON.stringify(data)}`);
  }

  logger.debug("Discord API request successful", { status: res.status });
  return res;
}

export async function InstallGlobalCommands(appId, commands) {
  const endpoint = `applications/${appId}/commands`;

  logger.info("Installing global commands", {
    appId,
    commandCount: commands.length,
  });

  try {
    await DiscordRequest(endpoint, { method: "PUT", body: commands });
    logger.success("Global commands installed successfully");
  } catch (err) {
    logger.error("Failed to install global commands", { error: err.message });
    throw err;
  }
}
// --- Gestion des votes actifs (partagée) ---
export const activeVotes = new Map();

// --- Initialisation du client discord.js ---
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Si tu veux lire le contenu des messages (optionnel)
    GatewayIntentBits.GuildMessageReactions, // Nécessaire pour les réactions
  ],
});

client.once("ready", () => {
  console.log(`[discord] Bot prêt en tant que ${client.user.tag}`);
  logger.info(`Discord client logged in as ${client.user.tag}`);
});

// Gestion des réactions ajoutées
client.on("messageReactionAdd", (reaction, user) => {
  console.log(
    `[discord] Réaction ajoutée par ${user.tag} : ${reaction.emoji.name} sur message ${reaction.message.id}`
  );

  if (user.bot) return;

  for (const [voteId, voteData] of activeVotes.entries()) {
    if (reaction.message.id === voteData.voteMessageId) {
      const emojiMap = { "1️⃣": 0, "2️⃣": 1, "3️⃣": 2, "4️⃣": 3 };
      const voteIndex = emojiMap[reaction.emoji.name];

      if (voteIndex !== undefined) {
        voteData.votes[voteIndex]++;
        console.log(
          `[vote] Utilisateur ${user.tag} a voté pour Map ${
            voteIndex + 1
          }. Total votes: ${voteData.votes[voteIndex]}`
        );
      } else {
        console.log(
          `[vote] Réaction reçue mais emoji non reconnu: ${reaction.emoji.name}`
        );
      }
      return;
    }
  }
  console.log(
    `[vote] Réaction reçue mais message non lié à un vote actif: messageId=${reaction.message.id}`
  );
});

// Fonction pour connecter le client (à appeler dans ton main.js ou index.js)
export async function startDiscordClient() {
  try {
    await client.login(process.env.BOT_TOKEN);
  } catch (err) {
    logger.error("Failed to login Discord client", { error: err.message });
    throw err;
  }
}
