import { InteractionResponseType } from "discord-interactions";
import { colors } from "../utils/colors.js";

export const helpCommand = {
  definition: {
    name: "help",
    description: "Affiche la liste des commandes disponibles sur WINR8TE",
    type: 1,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },

  async execute(interaction) {
    console.log("ℹ️ Executing help command");

    const helpEmbed = {
      title: "LISTE DES COMMANDES",
      description:
        "-# Les commandes sont en cours de développement. Nous vous avertirons lorsqu'elles seront à nouveau disponibles.\n\nVoici toutes les commandes disponibles sur **WINR8TE** :",
      color: colors.BLUE,
      fields: [
        {
          name: "⚙️ `/help`",
          value: "_Affiche cette liste de commandes_",
          inline: false,
        },
      ],
      footer: {
        text: "WINR8TE",
      },
      timestamp: new Date().toISOString(),
    };

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        embeds: [helpEmbed],
      },
    };
  },
};
