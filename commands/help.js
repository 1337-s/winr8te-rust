// commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { colors } from "../utils/colors.js";

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Affiche la liste des commandes disponibles sur WINR8TE"),

  async execute(interaction) {
    console.log("ℹ️ Executing help command");

    const helpEmbed = new EmbedBuilder()
      .setTitle("LISTE DES COMMANDES")
      .setDescription(
        "-# Les commandes sont en cours de développement. Nous vous avertirons lorsqu'elles seront à nouveau disponibles.\n\nVoici toutes les commandes disponibles sur **WINR8TE** :"
      )
      .setColor(colors.BLUE)
      .addFields({
        name: "⚙️ `/help`",
        value: "_Affiche cette liste de commandes_",
        inline: false,
      })
      .setFooter({ text: "WINR8TE" })
      .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed] });
  },
};
