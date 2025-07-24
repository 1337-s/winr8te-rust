// utils/reactions.js
import { EmbedBuilder } from "discord.js";
import { colors } from "./colors.js";
import { logger } from "./logger.js";
import { activeVotes } from "./discord.js";

// Émojis pour les votes
const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

// Fonction pour obtenir l'index depuis l'emoji
function getVoteIndex(emoji) {
  return VOTE_EMOJIS.indexOf(emoji);
}

// Gestion de l'ajout de réaction
export async function handleReactionAdd(reaction, user, client) {
  // Ignorer les bots
  if (user.bot) return;

  // Vérifier si c'est un partial et le fetch si nécessaire
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error("Error fetching reaction", { error: error.message });
      return;
    }
  }

  const messageId = reaction.message.id;
  const emoji = reaction.emoji.name;
  const voteIndex = getVoteIndex(emoji);

  // Vérifier si c'est un vote valide
  if (voteIndex === -1) return;

  // Trouver le vote actif correspondant
  let voteData = null;
  let voteId = null;

  for (const [id, data] of activeVotes.entries()) {
    if (data.voteMessageId === messageId) {
      voteData = data;
      voteId = id;
      break;
    }
  }

  if (!voteData) return;

  // Vérifier si le vote est encore actif
  if (new Date() > voteData.endTime) {
    return;
  }

  // Mettre à jour les votes (optionnel, pour le tracking)
  logger.info("Vote added", {
    userId: user.id,
    username: user.username,
    mapIndex: voteIndex + 1,
    voteId: voteId,
  });
}

// Gestion de la suppression de réaction
export async function handleReactionRemove(reaction, user, client) {
  // Ignorer les bots
  if (user.bot) return;

  // Vérifier si c'est un partial et le fetch si nécessaire
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error("Error fetching reaction", { error: error.message });
      return;
    }
  }

  const messageId = reaction.message.id;
  const emoji = reaction.emoji.name;
  const voteIndex = getVoteIndex(emoji);

  // Vérifier si c'est un vote valide
  if (voteIndex === -1) return;

  // Trouver le vote actif correspondant
  let voteData = null;
  let voteId = null;

  for (const [id, data] of activeVotes.entries()) {
    if (data.voteMessageId === messageId) {
      voteData = data;
      voteId = id;
      break;
    }
  }

  if (!voteData) return;

  // Vérifier si le vote est encore actif
  if (new Date() > voteData.endTime) {
    return;
  }

  logger.info("Vote removed", {
    userId: user.id,
    username: user.username,
    mapIndex: voteIndex + 1,
    voteId: voteId,
  });
}

// Fonction pour compter les votes
export async function countVotes(messageId, client) {
  try {
    const voteData = Array.from(activeVotes.values()).find(
      (data) => data.voteMessageId === messageId
    );
    if (!voteData) return null;

    const channel = await client.channels.fetch(voteData.channelId);
    const message = await channel.messages.fetch(messageId);

    const voteCounts = [0, 0, 0, 0];

    for (let i = 0; i < VOTE_EMOJIS.length; i++) {
      const emoji = VOTE_EMOJIS[i];
      const reaction = message.reactions.cache.get(emoji);
      if (!reaction) continue;

      const users = await reaction.users.fetch();
      users.forEach((user) => {
        if (!user.bot) voteCounts[i]++;
      });
    }

    const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);
    return {
      votes: voteCounts,
      total: totalVotes,
    };
  } catch (error) {
    logger.error("Error counting votes", { error: error.message });
    return null;
  }
}

// Fonction pour terminer un vote
export async function endVote(voteId, client) {
  try {
    const voteData = activeVotes.get(voteId);
    if (!voteData) return;

    const channel = await client.channels.fetch(voteData.channelId);
    const message = await channel.messages.fetch(voteData.voteMessageId);

    // Compter les votes finaux
    const result = await countVotes(voteData.voteMessageId, client);

    if (!result) {
      logger.error("Could not count votes for ending", { voteId });
      return;
    }

    // Trouver la map gagnante
    const maxVotes = Math.max(...result.votes);
    const winnerIndex = result.votes.indexOf(maxVotes);
    const winningImage = voteData.images[winnerIndex];
    const winningLink = voteData.links[winnerIndex];

    // Créer l'embed de résultat
    const testModeIndicator = voteData.testMode ? "🧪 **MODE TEST** - " : "";
    const resultEmbed = new EmbedBuilder()
      .setTitle(`${testModeIndicator}🌍 MAP VOTE TERMINÉ`)
      .setColor(colors.YELLOW)
      .setDescription(
        `**Map ${winnerIndex + 1}** remporte le vote avec **${maxVotes}** votes`
      )
      .addFields({
        name: "Lien vers la map",
        value: `[Voir la map](${winningLink})`,
        inline: true,
      })
      .setImage(winningImage);

    // Envoyer le résultat
    await channel.send({ embeds: [resultEmbed] });

    // Supprimer le vote de la liste active
    activeVotes.delete(voteId);

    logger.success("Vote ended", {
      voteId,
      winner: winnerIndex + 1,
      totalVotes: result.total,
    });
  } catch (error) {
    logger.error("Error ending vote", { voteId, error: error.message });
  }
}

// Fonction pour programmer la fin du vote
export function scheduleVoteEnd(voteId, endTime) {
  const now = new Date();
  const delay = endTime.getTime() - now.getTime();

  if (delay > 0) {
    setTimeout(async () => {
      // Import dynamique pour éviter les références circulaires
      const { client } = await import("../bot.js");
      await endVote(voteId, client);
    }, delay);

    logger.info("Vote end scheduled", {
      voteId,
      endTime: endTime.toISOString(),
      delayMs: delay,
    });
  }
}
