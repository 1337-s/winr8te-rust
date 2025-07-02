import { InteractionResponseType } from "discord-interactions";

export const testCommand = {
  // Définition de la commande pour Discord
  definition: {
    name: "test",
    description: "Commande de test basique",
    type: 1,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
  },

  // Fonction d'exécution de la commande
  async execute(interaction) {
    console.log("🧪 Executing test command");

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ Ca fonctionne",
        flags: 64, // Ephemeral message (visible seulement par l'utilisateur)
      },
    };
  },
};
