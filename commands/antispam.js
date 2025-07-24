// commands/antispam.js
import {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { colors } from "../utils/colors.js";
import { unbanUser, getSpamConfig } from "../utils/antispam.js";

export const spamConfigCommand = {
  data: new SlashCommandBuilder()
    .setName("spam_config")
    .setDescription("Affiche la configuration actuelle du système anti-spam")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const config = getSpamConfig();

      const embed = new EmbedBuilder()
        .setTitle("⚙️ Configuration Anti-Spam")
        .setColor(colors.BLUE)
        .addFields(
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
          }
        )
        .setTimestamp()
        .setFooter({ text: "Configuration Anti-Spam" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la config antispam:",
        error
      );
      await interaction.reply({
        content:
          "❌ Une erreur est survenue lors de la récupération de la configuration.",
        ephemeral: true,
      });
    }
  },
};

export const unbanDiscordCommand = {
  data: new SlashCommandBuilder()
    .setName("unbandiscord")
    .setDescription("Retire un utilisateur de la liste des bannis")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("user_id")
        .setDescription("ID de l'utilisateur à débannir")
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      const userIdString = interaction.options.getString("user_id");
      const userId = parseInt(userIdString);

      if (isNaN(userId)) {
        await interaction.reply({
          content: "❌ L'ID utilisateur doit être un nombre valide.",
          ephemeral: true,
        });
        return;
      }

      const success = await unbanUser(userId);

      if (success) {
        await interaction.reply({
          content: `✅ L'utilisateur avec l'ID \`${userId}\` a été retiré de la liste des bannis.`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "⚠️ Cet utilisateur n'est pas dans la liste des bannis.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Erreur lors du déban:", error);
      await interaction.reply({
        content: "❌ Une erreur est survenue lors du déban.",
        ephemeral: true,
      });
    }
  },
};

export const clearCommand = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprime un nombre spécifique de messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Nombre de messages à supprimer (1-100)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    try {
      const amount = interaction.options.getInteger("amount");

      await interaction.reply({
        content: `🗑️ Suppression de ${amount} messages en cours...`,
        ephemeral: true,
      });

      const messages = await interaction.channel.messages.fetch({
        limit: amount,
      });
      const deleted = await interaction.channel.bulkDelete(messages, true);

      // Message de confirmation temporaire
      const confirmMessage = await interaction.channel.send(
        `✅ ${deleted.size} messages supprimés.`
      );

      // Supprimer le message de confirmation après 5 secondes
      setTimeout(() => {
        confirmMessage.delete().catch(() => {});
      }, 5000);
    } catch (error) {
      console.error("Erreur lors de la commande clear:", error);
      await interaction.followUp({
        content:
          "❌ Une erreur est survenue lors de la suppression des messages.",
        ephemeral: true,
      });
    }
  },
};
