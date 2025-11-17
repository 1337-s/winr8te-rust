// commands/forcemapvote.js
import { SlashCommandBuilder, PermissionsBitField } from "discord.js";
import { logger } from "../utils/logger.js";
import { launchAutoMapVote } from "../utils/autoMapvote.js";

export const forcemapvoteCommand = {
  data: new SlashCommandBuilder()
    .setName("forcemapvote")
    .setDescription("Force le lancement d'un MapVote automatique (Admin uniquement)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addBooleanOption((opt) =>
      opt
        .setName("immediate")
        .setDescription("Lancer le vote immédiatement (fin dans 2m)")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const immediate = interaction.options.getBoolean("immediate") || false;

      logger.info("Force MapVote triggered", {
        userId: interaction.user.id,
        username: interaction.user.username,
        immediate
      });

      // Lancer le vote
      await launchAutoMapVote(interaction.client, immediate);

      await interaction.editReply({
        content: `✅ MapVote automatique lancé avec succès!\n${
          immediate 
            ? "⚠️ Mode immédiat : le vote se terminera dans 12 m" 
            : "Le vote suivra le calendrier normal (fin 1h avant le wipe)"
        }`
      });

    } catch (error) {
      logger.error("Error forcing MapVote", { error: error.message });
      
      await interaction.editReply({
        content: `❌ Erreur lors du lancement du MapVote: ${error.message}`
      });
    }
  },
};
