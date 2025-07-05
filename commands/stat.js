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

export const statCommand = {
  definition: {
    name: "stat",
    description: "Affiche les statistiques d'un joueur",
    type: 1,
    integration_types: [0, 1],
    contexts: [0, 1, 2],
    options: [
      {
        name: "joueur",
        description: "Pseudo Rust du joueur dont vous voulez voir les stats",
        type: 3, // STRING
        required: true,
      },
    ],
  },

  async execute(interaction) {
    const playerName = interaction.data.options.find(
      (opt) => opt.name === "joueur"
    )?.value;

    if (!playerName) {
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "❌ Veuillez spécifier le nom d'un joueur.",
          flags: 64,
        },
      };
    }

    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);

      const [rows] = await connection.execute(
        "SELECT StatisticsDB, `Time Played` FROM PlayerDatabase WHERE name = ?",
        [playerName]
      );

      if (rows.length === 0) {
        return {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Joueur **${playerName}** non trouvé`,
            flags: 64,
          },
        };
      }

      const { StatisticsDB, "Time Played": timePlayed } = rows[0];
      const stats = JSON.parse(StatisticsDB);

      // Formatage du temps joué
      const playedText = formatPlayTime(timePlayed);

      // Construction de l'embed
      const embed = createStatsEmbed(playerName, stats, playedText);

      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          embeds: [embed],
        },
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des stats:", error);
      return {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content:
            "❌ Une erreur est survenue lors de la récupération des statistiques.",
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

function formatPlayTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0 h 0 min 0 s";

  const totalSeconds = Math.floor(parseFloat(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${hours} h ${minutes} min ${remainingSeconds} s`;
}

function createStatsEmbed(playerName, stats, playedText) {
  const embed = {
    title: ``,
    description: `# Statistiques de ${playerName}`,
    color: colors.BLUE,
    fields: [],
  };

  // Format helper
  const formatStat = (label, value) => {
    const paddedLabel = label.padEnd(16);
    const paddedValue = String(value).padStart(4).padEnd(7); // Extra space à droite
    return `${paddedLabel}:  \`${paddedValue}\``;
  };

  // Stats de combat
  const combatStats = [
    formatStat("⚔️ Kills", stats.Kills || 0),
    formatStat("☠️ Morts", stats.Deaths || 0),
    formatStat("💀 Suicides", stats.Suicides || 0),
    formatStat("🤕 Wounded", stats.WoundedTimes || 0),
  ].join("\n");

  // Stats de tir
  const shootingStats = [
    formatStat("🔫 Tirs", stats.Shots || 0),
    formatStat("💢 Headshots", stats.Headshots || 0),
  ].join("\n");

  // Stats d'explosifs
  const explosiveStats = [
    formatStat("💥 Explosifs", stats.ExplosivesThrown || 0),
    formatStat("🚀 Roquettes", stats.RocketsLaunched || 0),
  ].join("\n");

  // Stats de craft
  const craftStats = formatStat("🛠️ Items craft", stats.CraftedItems || 0);

  // Stats diverses
  const miscStats = [
    formatStat("🎡 Tours de roue", stats.WheelSpins || 0),
    formatStat("🎤 Voix (octets)", stats.VoiceBytes || 0),
  ].join("\n");

  // Ajouter les champs à l'embed
  embed.fields.push(
    { name: "**COMBAT**", value: combatStats, inline: true },
    { name: "**TIR**", value: shootingStats, inline: true },
    {
      name: "**EXPLOSIFS**",
      value: explosiveStats,
      inline: true,
    },
    { name: "**CRAFT**", value: craftStats, inline: true },
    { name: "**DIVERS**", value: miscStats, inline: true },
    { name: "\u200b", value: "\u200b", inline: true } // Spacer
  );

  // Ressources récoltées
  const gathered = stats.Gathered || {};
  const resourcesText =
    Object.entries(gathered)
      .map(([resource, amount]) => `${resource} : ${amount}`)
      .join("\n") || "Aucune donnée";

  embed.fields.push({
    name: "**🌿 RESSOURCES**",
    value: `\`\`\`${resourcesText}\`\`\``,
    inline: false,
  });

  embed.fields.push({
    name: "**⏱️ TEMPS JOUÉ**",
    value: `\`\`\`${playedText}\`\`\``,
    inline: true,
  });

  if (stats.LastUpdate) {
    const lastUpdate = new Date(stats.LastUpdate * 1000);
    embed.fields.push({
      name: "**🕒 DERNIÈRE MISE À JOUR**",
      value: `\`\`\`${lastUpdate.toLocaleString("fr-FR", {
        timeZone: "Europe/Paris",
      })}\`\`\``,
      inline: true,
    });

    embed.fields.push({
      name: "\u200b", // champ vide pour l'espacement ou " " invisible
      value:
        "-# *Certaines statistiques peuvent avoir un délai de mise à jour et ne pas refléter la dernière mise à jour affichée. La plupart des statistiques sont actualisées à votre déconnexion/reconnexion sur le serveur.*",
      inline: false,
    });
  }

  return embed;
}
