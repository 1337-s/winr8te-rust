import { InteractionResponseType } from "discord-interactions";
import { colors } from "../utils/colors.js";
import mysql from "mysql2/promise";

// Configuration BDD
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Liste des stats disponibles avec leurs noms d'affichage
const availableStats = {
  kills: { key: "Kills", display: "Kills", emoji: "⚔️" },
  deaths: { key: "Deaths", display: "Morts", emoji: "☠️" },
  headshots: { key: "Headshots", display: "Headshots", emoji: "💢" },
  shots: { key: "Shots", display: "Tirs", emoji: "🔫" },
  suicides: { key: "Suicides", display: "Suicides", emoji: "💀" },
  wounded: { key: "WoundedTimes", display: "Wounded", emoji: "🤕" },
  explosives: { key: "ExplosivesThrown", display: "Explosifs", emoji: "💥" },
  rockets: { key: "RocketsLaunched", display: "Roquettes", emoji: "🚀" },
  crafted: { key: "CraftedItems", display: "Items craft", emoji: "🛠️" },
  wheelspins: { key: "WheelSpins", display: "Tours de roue", emoji: "🎡" },
  voicebytes: { key: "VoiceBytes", display: "Voix (octets)", emoji: "🎤" },
};

export const leaderboardCommand = {
  definition: {
    name: "leaderboard",
    description:
      "Affiche le classement des joueurs pour une statistique donnée",
    type: 1,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [
      {
        name: "stat",
        description: "Statistique à afficher",
        type: 3, // STRING
        required: true,
        choices: [
          { name: "⚔️ Kills", value: "kills" },
          { name: "☠️ Morts", value: "deaths" },
          { name: "💢 Headshots", value: "headshots" },
          { name: "🔫 Tirs", value: "shots" },
          { name: "💀 Suicides", value: "suicides" },
          { name: "🤕 Wounded", value: "wounded" },
          { name: "💥 Explosifs", value: "explosives" },
          { name: "🚀 Roquettes", value: "rockets" },
          { name: "🛠️ Items craft", value: "crafted" },
          { name: "🎡 Tours de roue", value: "wheelspins" },
          { name: "🎤 Voix (octets)", value: "voicebytes" },
        ],
      },
    ],
  },

  async execute(interaction) {
    const statName = interaction.data.options.find(
      (opt) => opt.name === "stat"
    )?.value;

    if (!statName || !availableStats[statName]) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "❌ Statistique invalide. Utilisez la liste déroulante pour choisir une statistique valide.",
          flags: 64,
        },
      };
    }

    const statConfig = availableStats[statName];
    let connection;

    try {
      connection = await mysql.createConnection(dbConfig);

      const [rows] = await connection.execute(
        "SELECT name, StatisticsDB FROM PlayerDatabase"
      );

      if (rows.length === 0) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: "❌ Aucun joueur trouvé dans la base de données.",
            flags: 64,
          },
        };
      }

      // Traitement des scores
      const scores = [];
      for (const row of rows) {
        try {
          const stats = JSON.parse(row.StatisticsDB);
          const value = parseInt(stats[statConfig.key] || 0);
          if (value > 0) {
            // On ne garde que les joueurs avec une valeur > 0
            scores.push({ name: row.name, value });
          }
        } catch (error) {
          console.warn(`Erreur parsing stats pour ${row.name}:`, error);
          continue;
        }
      }

      if (scores.length === 0) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Aucun joueur n'a de données pour la statistique **${statConfig.display}**.`,
            flags: 64,
          },
        };
      }

      // Tri par ordre décroissant
      scores.sort((a, b) => b.value - a.value);
      const top10 = scores.slice(0, 10);

      // Construction de l'embed
      const embed = createLeaderboardEmbed(statConfig, top10);

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
        },
      };
    } catch (error) {
      console.error("Erreur lors de la récupération du leaderboard:", error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "❌ Une erreur est survenue lors de la récupération du classement.",
          flags: 64,
        },
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  },
};

function createLeaderboardEmbed(statConfig, top10) {
  const embed = {
    title: ``,
    description: `# Leaderboard des ${statConfig.display} ${statConfig.emoji} `,
    color: colors.YELLOW,
    fields: [],
  };

  // Podium (top 3) avec mise en avant plus visible
  const podiumEmojis = ["🥇", "🥈", "🥉"];

  for (let i = 0; i < Math.min(3, top10.length); i++) {
    const player = top10[i];
    const formattedValue = player.value.toLocaleString("fr-FR");

    embed.fields.push({
      name: `${podiumEmojis[i]} **${player.name}**`,
      value: `\`\`\`
${formattedValue}
\`\`\``,
      inline: true,
    });
  }

  // Reste du classement (4-10)
  if (top10.length > 3) {
    const remainingPlayers = top10
      .slice(3)
      .map((player, index) => {
        const rank = index + 4;
        const formattedValue = player.value.toLocaleString("fr-FR");
        return `**${rank} -** **${player.name}** \`\`\`
${formattedValue}
\`\`\``;
      })
      .join("\n");

    embed.fields.push({
      name: "\u200b",
      value: remainingPlayers,
      inline: false,
    });
  }

  embed.fields.push({
    name: "\u200b", // champ vide pour l'espacement ou " " invisible
    value: "-# *Certaines statistiques peuvent avoir un délai de mise à jour.*",
    inline: false,
  });

  return embed;
}
