// commands/faq.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { colors } from "../utils/colors.js";
import fs from "fs/promises";
import { DateTime } from "luxon";

const FAQ_FILE = "faq_data.json";

// Fonction pour calculer le prochain vendredi à 18h00 CEST
function getNextWipeDate() {
  // Heure actuelle à Paris (CEST)
  const now = DateTime.now().setZone("Europe/Paris");

  // Trouver le prochain vendredi à 18h00
  let nextWipe = now.set({ hour: 18, minute: 0, second: 0, millisecond: 0 });

  // Si on est vendredi et qu'il est déjà 18h00 ou plus, passer au vendredi suivant
  if (now.weekday > 5 || (now.weekday === 5 && now.hour >= 18)) {
    nextWipe = nextWipe.plus({ weeks: 1 });
  } else {
    // Sinon, aller au vendredi de cette semaine
    nextWipe = nextWipe.plus({ days: 5 - now.weekday });
  }

  return nextWipe.toJSDate();
}

// Fonction pour charger les données FAQ
async function loadFAQData() {
  try {
    const data = await fs.readFile(FAQ_FILE, "utf8");
    const faqData = JSON.parse(data);

    // Mettre à jour dynamiquement la réponse du wipe avec la vraie date
    if (faqData.wipe) {
      const nextWipe = getNextWipeDate();
      const timestamp = Math.floor(nextWipe.getTime() / 1000);
      faqData.wipe.answer = `Le prochain wipe aura lieu <t:${timestamp}:F>\nLes wipes ont lieu tous les vendredis à 18h00 CEST. `;
    }

    return faqData;
  } catch (error) {
    // Si le fichier n'existe pas, retourner des données par défaut
    if (error.code === "ENOENT") {
      const nextWipe = getNextWipeDate();
      const timestamp = Math.floor(nextWipe.getTime() / 1000);

      const defaultData = {
        wipe: {
          question: "Quand est le prochain wipe ?",
          answer: `Le prochain wipe aura lieu <t:${timestamp}:F> et sera un fullwipe (bp + map).`,
        },
        groupelimite: {
          question: "Quelle est la limite de groupe ?",
          answer: "La limite de groupe est à 5 joueurs maximum.",
        },
      };
      await saveFAQData(defaultData);
      return defaultData;
    }
    throw error;
  }
}

// Fonction pour sauvegarder les données FAQ
async function saveFAQData(data) {
  await fs.writeFile(FAQ_FILE, JSON.stringify(data, null, 2));
}

export const faqCommand = {
  definition: {
    name: "faq",
    description: "Affiche les questions fréquemment posées",
    type: 1,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [
      {
        name: "action",
        description: "Action à effectuer",
        type: 3,
        required: true,
        choices: [
          {
            name: "Consulter une question",
            value: "view",
          },
          {
            name: "Ajouter une question (Admin)",
            value: "add",
          },
          {
            name: "Supprimer une question (Admin)",
            value: "remove",
          },
          {
            name: "Lister toutes les questions",
            value: "list",
          },
        ],
      },
      {
        name: "cle",
        description: "Clé de la question (ex: wipe, bp, groupe)",
        type: 3,
        required: false,
      },
      {
        name: "question",
        description: "La question à ajouter",
        type: 3,
        required: false,
      },
      {
        name: "reponse",
        description: "La réponse à la question",
        type: 3,
        required: false,
      },
    ],
  },

  async execute(interaction) {
    const action = interaction.data.options.find(
      (opt) => opt.name === "action"
    )?.value;
    const cle = interaction.data.options.find(
      (opt) => opt.name === "cle"
    )?.value;
    const question = interaction.data.options.find(
      (opt) => opt.name === "question"
    )?.value;
    const reponse = interaction.data.options.find(
      (opt) => opt.name === "reponse"
    )?.value;

    console.log(`[faq] Action: ${action}, Clé: ${cle}`);

    try {
      const faqData = await loadFAQData();

      switch (action) {
        case "view":
          return await handleViewFAQ(faqData, cle);

        case "list":
          return await handleListFAQ(faqData);

        case "add":
          return await handleAddFAQ(
            interaction,
            faqData,
            cle,
            question,
            reponse
          );

        case "remove":
          return await handleRemoveFAQ(interaction, faqData, cle);

        default:
          return {
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: "❌ Action non reconnue.",
              flags: 64,
            },
          };
      }
    } catch (error) {
      console.error("[faq] Erreur:", error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Une erreur s'est produite lors de l'accès à la FAQ.",
          flags: 64,
        },
      };
    }
  },
};

async function handleViewFAQ(faqData, cle) {
  if (!cle) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          "❌ Vous devez spécifier une clé de question. Utilisez `/faq list` pour voir toutes les questions disponibles.",
        flags: 64,
      },
    };
  }

  const faqItem = faqData[cle.toLowerCase()];
  if (!faqItem) {
    const availableKeys = Object.keys(faqData).join(", ");
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Question non trouvée pour la clé "${cle}"\n\nQuestions disponibles: ${availableKeys}`,
        flags: 64,
      },
    };
  }

  const embed = {
    title: "❓ FAQ",
    color: colors.BLUE,
    fields: [
      {
        name: "Question",
        value: faqItem.question,
        inline: false,
      },
      {
        name: "Réponse",
        value: faqItem.answer,
        inline: false,
      },
    ],
    footer: {
      text: "WINR8TE • FAQ",
    },
    timestamp: new Date().toISOString(),
  };

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
    },
  };
}

async function handleListFAQ(faqData) {
  const faqKeys = Object.keys(faqData);

  if (faqKeys.length === 0) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Aucune question dans la FAQ.",
        flags: 64,
      },
    };
  }

  const faqList = faqKeys
    .map((key) => {
      const item = faqData[key];
      return `**${key}** - ${item.question}`;
    })
    .join("\n");

  const embed = {
    title: "📋 Liste des questions FAQ",
    description: `Utilisez \`/faq view cle:<clé>\` pour afficher une question spécifique\n\n${faqList}`,
    color: colors.BLUE,
    footer: {
      text: "WINR8TE • FAQ",
    },
    timestamp: new Date().toISOString(),
  };

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
    },
  };
}

async function handleAddFAQ(interaction, faqData, cle, question, reponse) {
  // Vérifier les permissions admin (même logique que mapvote)
  const member = interaction.member;
  const hasAdminPermission =
    member?.permissions && (parseInt(member.permissions) & 0x8) === 0x8;

  if (!hasAdminPermission) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          "❌ Vous n'avez pas les permissions nécessaires pour ajouter une question FAQ.",
        flags: 64,
      },
    };
  }

  if (!cle || !question || !reponse) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          "❌ Vous devez spécifier une clé, une question et une réponse.",
        flags: 64,
      },
    };
  }

  const normalizedKey = cle.toLowerCase();
  faqData[normalizedKey] = {
    question: question,
    answer: reponse,
  };

  await saveFAQData(faqData);

  const embed = {
    title: "✅ Question FAQ ajoutée",
    color: colors.GREEN,
    fields: [
      {
        name: "Clé",
        value: normalizedKey,
        inline: true,
      },
      {
        name: "Question",
        value: question,
        inline: false,
      },
      {
        name: "Réponse",
        value: reponse,
        inline: false,
      },
    ],
    footer: {
      text: "WINR8TE • FAQ",
    },
    timestamp: new Date().toISOString(),
  };

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
    },
  };
}

async function handleRemoveFAQ(interaction, faqData, cle) {
  // Vérifier les permissions admin
  const member = interaction.member;
  const hasAdminPermission =
    member?.permissions && (parseInt(member.permissions) & 0x8) === 0x8;

  if (!hasAdminPermission) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          "❌ Vous n'avez pas les permissions nécessaires pour supprimer une question FAQ.",
        flags: 64,
      },
    };
  }

  if (!cle) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "❌ Vous devez spécifier une clé de question à supprimer.",
        flags: 64,
      },
    };
  }

  const normalizedKey = cle.toLowerCase();
  if (!faqData[normalizedKey]) {
    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❌ Aucune question trouvée pour la clé "${normalizedKey}".`,
        flags: 64,
      },
    };
  }

  const deletedItem = faqData[normalizedKey];
  delete faqData[normalizedKey];
  await saveFAQData(faqData);

  const embed = {
    title: "🗑️ Question FAQ supprimée",
    color: colors.RED,
    fields: [
      {
        name: "Clé supprimée",
        value: normalizedKey,
        inline: true,
      },
      {
        name: "Question supprimée",
        value: deletedItem.question,
        inline: false,
      },
    ],
    footer: {
      text: "WINR8TE • FAQ",
    },
    timestamp: new Date().toISOString(),
  };

  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      embeds: [embed],
    },
  };
}
