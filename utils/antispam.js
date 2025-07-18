import { promises as fs } from "fs";
import { logger } from "./logger.js";

// Configuration anti-spam
const SPAM_CONFIG = {
  // Spam classique
  SPAM_THRESHOLD: 5,
  TIME_WINDOW: 10,

  // Spam cross-channel
  CROSS_SPAM_THRESHOLD: 3,
  CROSS_TIME_WINDOW: 10,
  MIN_MESSAGE_LENGTH: 1,

  // Rôles et salons
  ROLE_NAME: "ban",
  LOG_CHANNEL_NAME: "⚪｜support-log",
  BAN_CHANNEL_NAME: "⛔｜vous-êtes-banni",
  RUST_ROLE_NAME: "Rust",

  // Fichier de stockage
  BANNED_USERS_FILE: "banned_users.json",
};

// Stockage en mémoire
const userMessages = new Map(); // {user_id: [timestamps]}
const userCrossMessages = new Map(); // {user_id: [(timestamp, message_content, channel_id)]}
let bannedUsers = [];

// Chargement des utilisateurs bannis
async function loadBannedUsers() {
  try {
    const data = await fs.readFile(SPAM_CONFIG.BANNED_USERS_FILE, "utf8");
    bannedUsers = JSON.parse(data);
    logger.info("Banned users loaded", { count: bannedUsers.length });
  } catch (error) {
    if (error.code === "ENOENT") {
      bannedUsers = [];
      logger.info("No banned users file found, starting fresh");
    } else {
      logger.error("Error loading banned users", { error: error.message });
    }
  }
}

// Sauvegarde des utilisateurs bannis
async function saveBannedUsers() {
  try {
    await fs.writeFile(
      SPAM_CONFIG.BANNED_USERS_FILE,
      JSON.stringify(bannedUsers, null, 2)
    );
    logger.info("Banned users saved", { count: bannedUsers.length });
  } catch (error) {
    logger.error("Error saving banned users", { error: error.message });
  }
}

// Normalisation du message pour comparaison
function normalizeMessage(content) {
  return content.toLowerCase().trim();
}

// Vérification du spam cross-channel
function isCrossChannelSpam(userId, messageContent, channelId) {
  const now = Date.now();
  const normalizedContent = normalizeMessage(messageContent);

  // Ignore les messages trop courts
  if (normalizedContent.length < SPAM_CONFIG.MIN_MESSAGE_LENGTH) {
    return false;
  }

  // Récupération ou création de l'historique utilisateur
  if (!userCrossMessages.has(userId)) {
    userCrossMessages.set(userId, []);
  }

  const userHistory = userCrossMessages.get(userId);

  // Ajout du message actuel
  userHistory.push([now, normalizedContent, channelId]);

  // Nettoyage des anciens messages
  const cutoffTime = now - SPAM_CONFIG.CROSS_TIME_WINDOW * 1000;
  const recentMessages = userHistory.filter(
    ([timestamp]) => timestamp > cutoffTime
  );
  userCrossMessages.set(userId, recentMessages);

  // Vérification du spam cross-channel
  const contentChannels = new Map();
  for (const [, content, chId] of recentMessages) {
    if (!contentChannels.has(content)) {
      contentChannels.set(content, new Set());
    }
    contentChannels.get(content).add(chId);
  }

  // Retourne true si le même message a été posté dans plusieurs salons
  for (const [, channels] of contentChannels) {
    if (channels.size >= SPAM_CONFIG.CROSS_SPAM_THRESHOLD) {
      return true;
    }
  }

  return false;
}

// Vérification du spam classique
function isClassicSpam(userId) {
  const now = Date.now();

  // Récupération ou création de l'historique utilisateur
  if (!userMessages.has(userId)) {
    userMessages.set(userId, []);
  }

  const userHistory = userMessages.get(userId);

  // Ajout du timestamp actuel
  userHistory.push(now);

  // Nettoyage des anciens messages
  const cutoffTime = now - SPAM_CONFIG.TIME_WINDOW * 1000;
  const recentMessages = userHistory.filter(
    (timestamp) => timestamp > cutoffTime
  );
  userMessages.set(userId, recentMessages);

  // Vérification du seuil
  return recentMessages.length >= SPAM_CONFIG.SPAM_THRESHOLD;
}

// Vérification des liens Discord
function containsDiscordInvite(messageContent) {
  const content = messageContent.toLowerCase();
  return (
    content.includes("discord.gg/") || content.includes("discord.com/invite/")
  );
}

// Application du rôle de ban
async function applyBanRole(member, reason, messageChannel, client) {
  try {
    const guild = member.guild;
    const role = guild.roles.cache.find(
      (r) => r.name === SPAM_CONFIG.ROLE_NAME
    );
    const logChannel = guild.channels.cache.find(
      (c) => c.name === SPAM_CONFIG.LOG_CHANNEL_NAME
    );
    const banChannel = guild.channels.cache.find(
      (c) => c.name === SPAM_CONFIG.BAN_CHANNEL_NAME
    );

    if (!role) {
      logger.error("Ban role not found", { roleName: SPAM_CONFIG.ROLE_NAME });
      return;
    }

    // Ajout du rôle
    await member.roles.add(role, reason);
    logger.info("Ban role applied", {
      userId: member.id,
      username: member.user.username,
      reason,
    });

    // Suppression des messages récents (limité pour éviter les erreurs)
    try {
      for (const channel of guild.channels.cache.values()) {
        if (channel.isTextBased()) {
          const messages = await channel.messages.fetch({ limit: 50 });
          const userMessages = messages.filter(
            (msg) => msg.author.id === member.id
          );

          for (const message of userMessages.values()) {
            try {
              await message.delete();
            } catch (deleteError) {
              logger.warn("Failed to delete message", {
                channelId: channel.id,
                messageId: message.id,
                error: deleteError.message,
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error("Error during message cleanup", { error: error.message });
    }

    // Ajout à la liste des bannis
    if (!bannedUsers.includes(member.id)) {
      bannedUsers.push(member.id);
      await saveBannedUsers();

      // Log dans le salon dédié
      if (logChannel) {
        const embed = {
          title: "🛡️ Spam détecté",
          description: `**Utilisateur :** ${member.user.toString()} (\`${
            member.user.tag
          }\`)\n**Action :** Ajout du rôle \`${
            SPAM_CONFIG.ROLE_NAME
          }\`\n**Raison :** ${reason}\n**Salon :** ${messageChannel.toString()}`,
          color: 0xc4113e,
          timestamp: new Date().toISOString(),
          footer: {
            text: "Modération automatique",
          },
        };

        await logChannel.send({ embeds: [embed] });
      }

      // Message dans le salon de ban
      if (banChannel) {
        // Suppression de l'ancien message du bot
        const botMessages = await banChannel.messages.fetch({ limit: 10 });
        const oldBotMessage = botMessages.find(
          (msg) => msg.author.id === client.user.id
        );
        if (oldBotMessage) {
          await oldBotMessage.delete();
        }

        // Envoi du nouvel embed
        const banEmbed = {
          title: "🚫 Vous avez été banni du serveur",
          description:
            "Ce bannissement peut résulter d'une infraction au règlement, détectée par notre modération ou par un système automatique.\n\n**📖 Règlement**\nAvant toute chose, nous vous invitons à consulter le salon <#1378717958360137828> afin de prendre connaissance des règles du serveur.\n\n**🔨 Contacter la modération**\nSi vous ne comprenez pas les raisons de ce bannissement, ou si vous souhaitez contester la décision, vous pouvez ouvrir un ticket dans le salon <#1378759077282447521>.\n\nNous vous demandons de rester courtois dans vos échanges. Toute insulte ou provocation pourra aggraver votre situation.",
          color: 0xc4113e,
          footer: {
            text: "L'équipe de modération WINR8TE",
          },
        };

        await banChannel.send({ embeds: [banEmbed] });
      }
    }

    // Nettoyage de l'historique de l'utilisateur
    userMessages.delete(member.id);
    userCrossMessages.delete(member.id);
  } catch (error) {
    logger.error("Error applying ban role", {
      userId: member.id,
      error: error.message,
    });
  }
}

// Réapplication du rôle de ban lors de la reconnexion
async function handleMemberJoin(member) {
  try {
    // Vérification si l'utilisateur est dans la liste des bannis
    if (bannedUsers.includes(member.id)) {
      const role = member.guild.roles.cache.find(
        (r) => r.name === SPAM_CONFIG.ROLE_NAME
      );
      if (role) {
        await member.roles.add(role, "Rôle ban réappliqué à la reconnexion");
        logger.info("Ban role reapplied on rejoin", {
          userId: member.id,
          username: member.user.username,
        });
      }
    }

    // Attribution automatique du rôle Rust
    const rustRole = member.guild.roles.cache.find(
      (r) => r.name === SPAM_CONFIG.RUST_ROLE_NAME
    );
    if (rustRole) {
      await member.roles.add(rustRole, "Attribution automatique à l'arrivée");
      logger.info("Rust role assigned to new member", {
        userId: member.id,
        username: member.user.username,
      });
    }
  } catch (error) {
    logger.error("Error handling member join", {
      userId: member.id,
      error: error.message,
    });
  }
}

// Gestionnaire principal des messages
async function handleMessage(message, client) {
  // Ignorer les bots
  if (message.author.bot) return;

  const userId = message.author.id;
  const member = message.member;

  // Vérification du spam classique
  if (isClassicSpam(userId)) {
    await applyBanRole(
      member,
      "Spam classique détecté automatiquement",
      message.channel,
      client
    );
    return;
  }

  // Vérification du spam cross-channel
  if (isCrossChannelSpam(userId, message.content, message.channel.id)) {
    await applyBanRole(
      member,
      "Spam cross-channel détecté automatiquement",
      message.channel,
      client
    );
    return;
  }

  // Vérification des liens Discord pour les membres avec le rôle Rust
  const rustRole = message.guild.roles.cache.find(
    (r) => r.name === SPAM_CONFIG.RUST_ROLE_NAME
  );
  if (rustRole && member.roles.cache.has(rustRole.id)) {
    if (containsDiscordInvite(message.content)) {
      await applyBanRole(
        member,
        "Lien Discord détecté (interdit pour le rôle Rust)",
        message.channel,
        client
      );
      return;
    }
  }
}

// Commande pour débannir un utilisateur
async function unbanUser(userId) {
  const index = bannedUsers.indexOf(userId);
  if (index > -1) {
    bannedUsers.splice(index, 1);
    await saveBannedUsers();
    logger.info("User unbanned", { userId });
    return true;
  }
  return false;
}

// Configuration actuelle
function getSpamConfig() {
  return {
    ...SPAM_CONFIG,
    bannedUsersCount: bannedUsers.length,
    monitoredUsersCount: userMessages.size,
  };
}

// Initialisation
async function initializeAntispam() {
  await loadBannedUsers();
  logger.info("Antispam system initialized");
}

export {
  initializeAntispam,
  handleMessage,
  handleMemberJoin,
  unbanUser,
  getSpamConfig,
};
