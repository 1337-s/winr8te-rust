import { InteractionResponseType, InteractionType } from "discord-interactions";
import { colors } from "../utils/colors.js";
import { DiscordRequest, activeVotes } from "../utils/discord.js";
import mysql from "mysql2/promise";

// Configuration BDD
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

export const mapvoteCommand = {
  definition: {
    name: "mapvote",
    description:
      "Lance un vote de map pour le prochain wipe (Admin uniquement)",
    type: 1,
    integration_types: [0],
    contexts: [0],
    default_member_permissions: "8",
    options: [
      {
        name: "image1",
        description: "URL de l'image de la map 1",
        type: 3,
        required: true,
      },
      {
        name: "link1",
        description: "Lien RustMaps de la map 1",
        type: 3,
        required: true,
      },
      {
        name: "seed1",
        description: "Seed de la map 1",
        type: 3,
        required: true,
      },
      {
        name: "image2",
        description: "URL de l'image de la map 2",
        type: 3,
        required: true,
      },
      {
        name: "link2",
        description: "Lien RustMaps de la map 2",
        type: 3,
        required: true,
      },
      {
        name: "seed2",
        description: "Seed de la map 2",
        type: 3,
        required: true,
      },
      {
        name: "image3",
        description: "URL de l'image de la map 3",
        type: 3,
        required: true,
      },
      {
        name: "link3",
        description: "Lien RustMaps de la map 3",
        type: 3,
        required: true,
      },
      {
        name: "seed3",
        description: "Seed de la map 3",
        type: 3,
        required: true,
      },
      {
        name: "image4",
        description: "URL de l'image de la map 4",
        type: 3,
        required: true,
      },
      {
        name: "link4",
        description: "Lien RustMaps de la map 4",
        type: 3,
        required: true,
      },
      {
        name: "seed4",
        description: "Seed de la map 4",
        type: 3,
        required: true,
      },
    ],
  },

  async execute(interaction) {
    const images = [
      interaction.data.options.find((opt) => opt.name === "image1")?.value,
      interaction.data.options.find((opt) => opt.name === "image2")?.value,
      interaction.data.options.find((opt) => opt.name === "image3")?.value,
      interaction.data.options.find((opt) => opt.name === "image4")?.value,
    ];

    const links = [
      interaction.data.options.find((opt) => opt.name === "link1")?.value,
      interaction.data.options.find((opt) => opt.name === "link2")?.value,
      interaction.data.options.find((opt) => opt.name === "link3")?.value,
      interaction.data.options.find((opt) => opt.name === "link4")?.value,
    ];

    const seeds = [
      interaction.data.options.find((opt) => opt.name === "seed1")?.value,
      interaction.data.options.find((opt) => opt.name === "seed2")?.value,
      interaction.data.options.find((opt) => opt.name === "seed3")?.value,
      interaction.data.options.find((opt) => opt.name === "seed4")?.value,
    ];

    // Calculer les dates
    const now = new Date();
    const nextFriday = getNextFriday17h();
    const wipeTime = new Date(nextFriday.getTime() + 60 * 60 * 1000); // +1h pour le wipe

    // Stocker le vote actif
    const voteId = interaction.id;
    activeVotes.set(voteId, {
      images,
      links,
      seeds,
      votes: [0, 0, 0, 0],
      endTime: nextFriday,
      channelId: interaction.channel_id,
      voteMessageId: null,
    });

    console.log(
      `[mapvote] Vote créé avec ID ${voteId} - channel: ${interaction.channel_id}`
    );
    console.log(`[mapvote] Votes initiaux:`, activeVotes.get(voteId).votes);
    // Programmer la fin du vote
    scheduleVoteEnd(voteId, nextFriday);

    // Réponse initiale
    await sendVoteMessages(
      interaction,
      images,
      links,
      seeds,
      nextFriday,
      wipeTime
    );

    return {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: "✅ MapVote lancé avec succès !",
        flags: 64,
      },
    };
  },
};

async function sendVoteMessages(
  interaction,
  images,
  links,
  seeds,
  endTime,
  wipeTime
) {
  const channelId = interaction.channel_id;
  const voteId = interaction.id;

  // Message d'annonce
  const announceEmbed = {
    title: "🌍 MAP VOTE LANCÉ",
    color: colors.BLUE,
    fields: [
      {
        name: "🕐 Prochain wipe (fullwipe)",
        value: `<t:${Math.floor(wipeTime.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: "⏰ Fin du vote",
        value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
        inline: true,
      },
    ],
  };

  await DiscordRequest(`channels/${channelId}/messages`, {
    method: "POST",
    body: {
      content: "@everyone",
      embeds: [announceEmbed],
      allowed_mentions: { parse: ["everyone"] },
    },
  });

  // Préparer le même URL à mettre dans chaque embed (par ex. la home de ton bot)
  const commonUrl = "https://winr8te.com";

  // Créer les 4 embeds avec la même URL, premier avec titre+desc, les autres juste l'image
  const embeds = images.map((img, i) => {
    if (i === 0) {
      return {
        color: colors.BLUE,
        url: commonUrl,
        image: { url: img },
        footer: { text: `Seed: ${seeds[i]}` },
      };
    } else {
      return {
        url: commonUrl,
        image: { url: img },
        footer: { text: `Seed: ${seeds[i]}` },
      };
    }
  });

  // Boutons pour les liens RustMaps
  const buttons = [
    {
      type: 1, // Action Row 1
      components: [
        {
          type: 2, // Button
          style: 5, // Link style
          label: "Map 1",
          url: links[0],
        },
        {
          type: 2,
          style: 5,
          label: "Map 2",
          url: links[1],
        },
      ],
    },
    {
      type: 1, // Action Row 2
      components: [
        {
          type: 2,
          style: 5,
          label: "Map 3",
          url: links[2],
        },
        {
          type: 2,
          style: 5,
          label: "Map 4",
          url: links[3],
        },
      ],
    },
  ];

  // Envoyer un seul message avec les 4 embeds ET les boutons
  await DiscordRequest(`channels/${channelId}/messages`, {
    method: "POST",
    body: {
      embeds: embeds,
      components: buttons,
    },
  });

  // Message de vote avec réactions (idem que ton code)
  const voteEmbed = {
    title: "VOTEZ POUR LA PROCHAINE MAP",
    description:
      "Cliquez sur les réactions pour voter pour votre map préférée :\n\n1️⃣ → Map 1\n2️⃣ → Map 2\n3️⃣ → Map 3\n4️⃣ → Map 4",
    color: colors.BLUE,
  };

  const voteMessage = await DiscordRequest(`channels/${channelId}/messages`, {
    method: "POST",
    body: { embeds: [voteEmbed] },
  });

  const messageData = await voteMessage.json();

  // Stocker l'ID du message de vote dans activeVotes pour reconnaitre les réactions
  const voteData = activeVotes.get(voteId);
  if (voteData) {
    voteData.voteMessageId = messageData.id;
    console.log(
      `[mapvote] voteMessageId mis à jour pour vote ${voteId} : ${messageData.id}`
    );
  } else {
    console.warn(
      `[mapvote] voteData introuvable pour voteId ${voteId} au moment de mise à jour voteMessageId`
    );
  }

  const reactions = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
  for (const reaction of reactions) {
    await DiscordRequest(
      `channels/${channelId}/messages/${
        messageData.id
      }/reactions/${encodeURIComponent(reaction)}/@me`,
      {
        method: "PUT",
      }
    );
    await new Promise((res) => setTimeout(res, 200));
  }
}

const TEST_MODE = true; // passe à false en prod

function getNextFriday17h() {
  if (TEST_MODE) {
    // En test : la date de fin sera dans 10 secondes
    return new Date(Date.now() + 20 * 1000);
  }
  const now = new Date();
  const friday = new Date();

  // Trouver le prochain vendredi
  const daysUntilFriday = (5 - now.getDay() + 7) % 7;
  if (daysUntilFriday === 0 && now.getHours() >= 17) {
    friday.setDate(now.getDate() + 7); // Vendredi suivant si déjà passé
  } else {
    friday.setDate(now.getDate() + daysUntilFriday);
  }

  friday.setHours(17, 0, 0, 0); // 17h00
  return friday;
}

function scheduleVoteEnd(voteId, endTime) {
  const timeout = endTime.getTime() - Date.now();

  // Si timeout négatif (possible en test), force minimum 1 sec
  const safeTimeout = timeout > 0 ? timeout : 1000;

  setTimeout(async () => {
    await endVote(voteId);
  }, safeTimeout);
}

async function endVote(voteId) {
  const voteData = activeVotes.get(voteId);
  if (!voteData) return;

  // Trouver la map gagnante
  const maxVotes = Math.max(...voteData.votes);
  const winnerIndex = voteData.votes.indexOf(maxVotes);
  const winnerSeed = voteData.seeds[winnerIndex];

  // Date du prochain wipe (1h après la fin du vote)
  const nextWipeDate = new Date(voteData.endTime.getTime() + 60 * 60 * 1000);
  // Envoyer le message d'annonce dans le canal du vote
  const channelId = voteData.channelId;

  const announceEmbed = {
    title: "🌍 MAP VOTE TERMINÉ",
    color: colors.YELLOW,
    fields: [
      {
        name: `Map gagnante : Map ${winnerIndex + 1}`,
        value: `**Seed:** \`${winnerSeed}\`\n**Nombre de votes:** **${maxVotes}**`,
        inline: false,
      },
      {
        name: "Lien vers la map",
        value: `[Voir la map ici](${voteData.links[winnerIndex]})`,
        inline: true,
      },
      {
        name: "Le wipe commence :",
        value: `<t:${Math.floor(nextWipeDate.getTime() / 1000)}:R>`,
        inline: true,
      },
    ],
    image: {
      url: voteData.images[winnerIndex],
    },
    footer: {
      text: "Merci à tous d'avoir participé au vote !",
    },
  };

  // Envoyer le message avec mention everyone et embed
  await DiscordRequest(`channels/${channelId}/messages`, {
    method: "POST",
    body: {
      content: "@everyone",
      embeds: [announceEmbed],
      allowed_mentions: { parse: ["everyone"] },
    },
  });

  // Mettre à jour la BDD
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      "UPDATE map_votes SET map_name = ?, map_seed = ?, votes = ?, vote_end_time = NOW() WHERE id = 1",
      [`Map ${winnerIndex + 1}`, winnerSeed, maxVotes]
    );
    await connection.end();

    console.log(
      `✅ Vote terminé - Map ${winnerIndex + 1} gagnante (seed: ${winnerSeed})`
    );
  } catch (error) {
    console.error("❌ Erreur BDD:", error);
  }

  activeVotes.delete(voteId);
}
