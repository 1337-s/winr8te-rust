import { InteractionResponseType } from "discord-interactions";

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
      description: "Voici toutes les commandes disponibles sur WINR8TE",
      color: 0x00ff00, // Vert
      fields: [
        {
          name: "/test",
          value: "Commande de test pour vérifier que le bot fonctionne",
          inline: false,
        },
        {
          name: "/help",
          value: "Affiche cette liste de commandes",
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
