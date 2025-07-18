import { InteractionResponseType } from "discord-interactions";
import { colors } from "../utils/colors.js";
import { unbanUser, getSpamConfig } from "../utils/antispam.js";
import { getDiscordClient } from "../utils/discord.js";

// Commande pour afficher la configuration antispam
export const spamConfigCommand = {
  definition: {
    name: "spam_config",
    description: "Affiche la configuration actuelle du système anti-spam",
    type: 1,
    integration_types: [0],
    contexts: [0],
    default_member_permissions: "8", // ADMINISTRATOR
  },

  async execute(interaction) {
    try {
      const config = getSpamConfig();

      const embed = {
        title: "⚙️ Configuration Anti-Spam",
        color: colors.BLUE,
        fields: [
          {
            name: "**Spam Classique**",
            value: `• Seuil : ${config.SPAM_THRESHOLD} messages\n• Fenêtre : ${config.TIME_WINDOW} secondes`,
            inline: false,
          },
          {
            name: "**Spam Cross-Channel**",
            value: `• Seuil : ${config.CROSS_SPAM_THRESHOLD} salons identiques\n• Fenêtre : ${config.CROSS_TIME_WINDOW} secondes\n• Longueur min : ${config.MIN_MESSAGE_LENGTH} caractères`,
            inline: false,
          },
          {
            name: "**Statistiques**",
            value: `• Utilisateurs bannis : ${config.bannedUsersCount}\n• Utilisateurs surveillés : ${config.monitoredUsersCount}`,
            inline: false,
          },
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: "Configuration Anti-Spam",
        },
      };

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
          flags: 64, // Ephemeral
        },
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la config antispam:",
        error
      );
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "❌ Une erreur est survenue lors de la récupération de la configuration.",
          flags: 64,
        },
      };
    }
  },
};

// Commande pour débannir un utilisateur
export const unbanDiscordCommand = {
  definition: {
    name: "unbandiscord",
    description: "Retire un utilisateur de la liste des bannis",
    type: 1,
    integration_types: [0],
    contexts: [0],
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        name: "user_id",
        description: "ID de l'utilisateur à débannir",
        type: 3, // STRING
        required: true,
      },
    ],
  },

  async execute(interaction) {
    try {
      const userIdString = interaction.data.options.find(
        (opt) => opt.name === "user_id"
      )?.value;

      if (!userIdString) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Veuillez spécifier l'ID de l'utilisateur.",
            flags: 64,
          },
        };
      }

      const userId = parseInt(userIdString);

      if (isNaN(userId)) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ L'ID utilisateur doit être un nombre valide.",
            flags: 64,
          },
        };
      }

      const success = await unbanUser(userId);

      if (success) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `✅ L'utilisateur avec l'ID \`${userId}\` a été retiré de la liste des bannis.`,
            flags: 64,
          },
        };
      } else {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "⚠️ Cet utilisateur n'est pas dans la liste des bannis.",
            flags: 64,
          },
        };
      }
    } catch (error) {
      console.error("Erreur lors du déban:", error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Une erreur est survenue lors du déban.",
          flags: 64,
        },
      };
    }
  },
};

// Commande pour nettoyer les messages
export const clearCommand = {
  definition: {
    name: "clear",
    description: "Supprime un nombre spécifique de messages",
    type: 1,
    integration_types: [0],
    contexts: [0],
    default_member_permissions: "8", // ADMINISTRATOR
    options: [
      {
        name: "amount",
        description: "Nombre de messages à supprimer (1-100)",
        type: 4, // INTEGER
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ],
  },

  async execute(interaction) {
    try {
      const amount = interaction.data.options.find(
        (opt) => opt.name === "amount"
      )?.value;

      if (!amount || amount < 1 || amount > 100) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Vous devez spécifier un nombre entre 1 et 100.",
            flags: 64,
          },
        };
      }

      // Pour cette commande, nous devons utiliser le client Discord
      const client = getDiscordClient();
      if (!client) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Le client Discord n'est pas disponible.",
            flags: 64,
          },
        };
      }

      // Réponse immédiate pour éviter le timeout
      const response = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `🗑️ Suppression de ${amount} messages en cours...`,
          flags: 64,
        },
      };

      // Effectuer la suppression en arrière-plan
      setTimeout(async () => {
        try {
          const channel = await client.channels.fetch(interaction.channel_id);
          if (channel && channel.isTextBased()) {
            const messages = await channel.messages.fetch({ limit: amount });
            const deleted = await channel.bulkDelete(messages, true);

            // Envoyer un message de confirmation (qui sera supprimé automatiquement)
            const confirmMessage = await channel.send(
              `✅ ${deleted.size} messages supprimés.`
            );

            // Supprimer le message de confirmation après 5 secondes
            setTimeout(() => {
              confirmMessage.delete().catch(() => {});
            }, 5000);
          }
        } catch (error) {
          console.error("Erreur lors de la suppression des messages:", error);
        }
      }, 1000);

      return response;
    } catch (error) {
      console.error("Erreur lors de la commande clear:", error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "❌ Une erreur est survenue lors de la suppression des messages.",
          flags: 64,
        },
      };
    }
  },
};
