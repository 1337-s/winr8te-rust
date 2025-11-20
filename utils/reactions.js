// utils/reactions.js
import { EmbedBuilder } from "discord.js";
import { colors } from "./colors.js";
import { logger } from "./logger.js";
import { activeVotes } from "./discord.js";
import { saveWinningSeed } from "./database.js";

// Émojis pour les votes
const VOTE_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

function getVoteIndex(emoji) {
  return VOTE_EMOJIS.indexOf(emoji);
}

// Gestion des ajouts de réaction
export async function handleReactionAdd(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const voteIndex = getVoteIndex(reaction.emoji.name);
  if (voteIndex === -1) return;

  const voteData = Array.from(activeVotes.values()).find(
    (v) => v.voteMessageId === reaction.message.id
  );
  if (!voteData || new Date() > voteData.endTime) return;

  logger.info("Vote added", {
    userId: user.id,
    username: user.username,
    mapIndex: voteIndex + 1,
    voteId: voteData.voteMessageId,
    isMapwipe: voteData.isMapwipe || false,
  });
}

// Gestion des suppressions de réaction
export async function handleReactionRemove(reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => null);

  const voteIndex = getVoteIndex(reaction.emoji.name);
  if (voteIndex === -1) return;

  const voteData = Array.from(activeVotes.values()).find(
    (v) => v.voteMessageId === reaction.message.id
  );
  if (!voteData || new Date() > voteData.endTime) return;

  logger.info("Vote removed", {
    userId: user.id,
    username: user.username,
    mapIndex: voteIndex + 1,
    voteId: voteData.voteMessageId,
    isMapwipe: voteData.isMapwipe || false,
  });
}

// Compter les votes
export async function countVotes(messageId, client) {
  const voteData = Array.from(activeVotes.values()).find(
    (v) => v.voteMessageId === messageId
  );
  if (!voteData) return null;

  try {
    const channel = await client.channels.fetch(voteData.channelId);
    const message = await channel.messages.fetch(messageId);

    const voteCounts = [0, 0, 0, 0];

    for (let i = 0; i < VOTE_EMOJIS.length; i++) {
      const reaction = message.reactions.cache.get(VOTE_EMOJIS[i]);
      if (!reaction) continue;

      const users = await reaction.users.fetch();
      users.forEach((u) => {
        if (!u.bot) voteCounts[i]++;
      });
    }

    return {
      votes: voteCounts,
      total: voteCounts.reduce((a, b) => a + b, 0),
    };
  } catch (error) {
    // Message supprimé ou erreur de fetch
    logger.error("Cannot count votes - message may have been deleted", {
      messageId,
      error: error.message,
    });
    return null;
  }
}

// Terminer un vote
export async function endVote(voteId, client) {
  try {
    const voteData = activeVotes.get(voteId);
    if (!voteData) {
      logger.warn("Vote data not found", { voteId });
      return;
    }

    // Vérifier que le canal existe toujours
    let channel;
    try {
      channel = await client.channels.fetch(voteData.channelId);
    } catch (error) {
      logger.error("Vote channel not found", {
        voteId,
        channelId: voteData.channelId,
        error: error.message,
      });
      activeVotes.delete(voteId);
      return;
    }

    // Tenter de récupérer le message
    let message;
    try {
      message = await channel.messages.fetch(voteData.voteMessageId);
    } catch (error) {
      logger.error("Vote message not found (may have been deleted)", {
        voteId,
        messageId: voteData.voteMessageId,
        error: error.message,
      });

      // Message supprimé : envoyer une notification et nettoyer
      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚠️ Vote annulé")
              .setDescription(
                "Le message de vote a été supprimé. Aucun résultat ne peut être calculé."
              )
              .setColor(colors.RED),
          ],
        })
        .catch(() => {});

      activeVotes.delete(voteId);
      return;
    }

    // Compter les votes finaux
    const result = await countVotes(voteData.voteMessageId, client);
    if (!result) {
      logger.error("Could not count votes for ending", { voteId });
      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ Erreur de comptage")
              .setDescription("Impossible de compter les votes.")
              .setColor(colors.RED),
          ],
        })
        .catch(() => {});

      activeVotes.delete(voteId);
      return;
    }

    // Déterminer la/les map(s) gagnante(s)
    const maxVotes = Math.max(...result.votes.slice(0, 3));
    const winners = [];
    result.votes.slice(0, 3).forEach((v, i) => {
      if (v === maxVotes) winners.push(i);
    });

    // Gestion des égalités : choisir aléatoirement une map gagnante
    const winnerIndex = winners[Math.floor(Math.random() * winners.length)];
    const winningSeed = voteData.seeds[winnerIndex];
    const winningImage = voteData.images[winnerIndex];
    const winningLink = voteData.links[winnerIndex];

    // Sécuriser les seeds et votes avant DB
    const seeds = [
      voteData.seeds[0]?.toString() || "0",
      voteData.seeds[1]?.toString() || "0",
      voteData.seeds[2]?.toString() || "0",
    ];
    const votes = [
      result.votes[0] ?? 0,
      result.votes[1] ?? 0,
      result.votes[2] ?? 0,
    ];
    const totalVotes = votes.reduce((a, b) => a + b, 0);

    // Sauvegarde dans la BDD
    try {
      await saveWinningSeed(winningSeed, voteData.wipeDate, { seeds }, votes);
    } catch (dbError) {
      logger.error("Failed to save winning seed to database", {
        voteId,
        error: dbError.message,
      });
      // Continuer quand même pour afficher les résultats
    }

    // Envoyer embed de résultat
    const embedColor = voteData.isMapwipe ? colors.GREEN : colors.YELLOW;
    const resultEmbed = new EmbedBuilder()
      .setTitle(`🌍 MAP VOTE TERMINÉ`)
      .setColor(embedColor)
      .setDescription(
        `**Map ${winnerIndex + 1}** remporte le vote avec **${maxVotes}** votes`
      )
      .addFields(
        { name: "Seed gagnante", value: `\`${winningSeed}\``, inline: true },
        {
          name: "Lien vers la map",
          value: `[Voir la map](${winningLink})`,
          inline: true,
        },
        { name: "Total des votes", value: `${totalVotes}`, inline: true }
      )
      .setImage(winningImage);

    await channel.send({ embeds: [resultEmbed] }).catch((error) => {
      logger.error("Failed to send vote results", {
        voteId,
        error: error.message,
      });
    });

    // Supprimer le vote actif
    activeVotes.delete(voteId);

    logger.success("Vote ended", {
      voteId,
      winner: winnerIndex + 1,
      totalVotes,
      isMapwipe: voteData.isMapwipe || false,
    });
  } catch (error) {
    logger.error("Error ending vote", { voteId, error: error.message });
    // Nettoyer quand même
    activeVotes.delete(voteId);
  }
}

// Programmer la fin du vote
export function scheduleVoteEnd(voteId, endTime) {
  const now = new Date();
  const delay = endTime.getTime() - now.getTime();

  if (delay > 0) {
    setTimeout(async () => {
      const { client } = await import("../bot.js");
      await endVote(voteId, client);
    }, delay);

    logger.info("Vote end scheduled", {
      voteId,
      endTime: endTime.toISOString(),
      delayMs: delay,
    });
  } else {
    logger.warn("Vote end time has already passed", {
      voteId,
      endTime: endTime.toISOString(),
    });
  }
}
