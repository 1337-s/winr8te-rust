// utils/autoMapvote.js
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { DateTime } from "luxon";
import { colors } from "./colors.js";
import { logger } from "./logger.js";
import { activeVotes } from "./discord.js";
import { scheduleVoteEnd } from "./reactions.js";
import { getDbConnection } from "./database.js";

const MAP_SIZE = 3500;
const VOTE_CHANNEL_ID = process.env.VOTE_CHANNEL_ID;
const RUSTMAPS_API_KEY = process.env.RUSTMAPS_API_KEY;
const RUSTMAPS_API_URL = "https://api.rustmaps.com/v4";

// Générer une seed aléatoire
function generateRandomSeed() {
  return Math.floor(Math.random() * 999999999);
}

// --- RustMaps API ---
async function createRustMap(seed, size = MAP_SIZE) {
  try {
    const response = await fetch(`${RUSTMAPS_API_URL}/maps`, {
      method: "POST",
      headers: {
        "X-API-Key": RUSTMAPS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ size, seed, staging: false })
    });

    const data = await response.json();

    if ([200, 201, 409].includes(response.status)) {
      return data.data || {};
    }

    throw new Error(`Unexpected response: ${response.status}`);
  } catch (error) {
    logger.error("Error creating map on RustMaps", { seed, error: error.message });
    throw error;
  }
}

async function checkMapStatus(seed, size = MAP_SIZE) {
  try {
    const response = await fetch(`${RUSTMAPS_API_URL}/maps/${size}/${seed}?staging=false`, {
      method: "GET",
      headers: { "X-API-Key": RUSTMAPS_API_KEY }
    });

    if (response.status === 200) {
      const data = await response.json();
      return { ready: true, mapData: data.data };
    }

    return { ready: false };
  } catch (error) {
    logger.error("Error checking map status", { seed, error: error.message });
    return { ready: false, error: true };
  }
}

async function waitForMapsGeneration(seeds, maxWaitMinutes = 30) {
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  const checkInterval = 30000;

  logger.info("Waiting for maps generation", { seeds, maxWaitMinutes });

  while (Date.now() - startTime < maxWaitMs) {
    const statuses = await Promise.all(seeds.map(seed => checkMapStatus(seed)));
    const allReady = statuses.every(s => s.ready);

    if (allReady) return statuses.map(s => s.mapData);

    await new Promise(r => setTimeout(r, checkInterval));
  }

  throw new Error("Timeout waiting for maps generation");
}

// Construire les données des maps
function buildMapData(mapApiData, seed) {
  return {
    seed,
    mapUrl: mapApiData.url,
    imageUrl: mapApiData.imageIconUrl || mapApiData.imageUrl,
    mapId: mapApiData.id
  };
}

// --- Wipes biweekly ---
function getNextWipeDate() {
  const now = DateTime.now().setZone("Europe/Paris");
  const monthStart = now.startOf("month");

  // Premier jeudi
  let firstThursday = monthStart.plus({ days: (4 - monthStart.weekday + 7) % 7 }).set({ hour: 20, minute: 0, second: 0 });
  // Troisième jeudi = 2 semaines après
  let thirdThursday = firstThursday.plus({ weeks: 2 }).set({ hour: 18, minute: 0, second: 0 });

  if (now <= firstThursday) return firstThursday.toJSDate();
  if (now <= thirdThursday) return thirdThursday.toJSDate();

  // Sinon premier jeudi du mois prochain
  const nextMonthStart = monthStart.plus({ months: 1 });
  let nextFirstThursday = nextMonthStart.plus({ days: (4 - nextMonthStart.weekday + 7) % 7 }).set({ hour: 20, minute: 0, second: 0 });
  return nextFirstThursday.toJSDate();
}

function getVoteStartTime(wipeDate) {
  return new Date(wipeDate.getTime() - 48 * 60 * 60 * 1000); // 48h avant
}

function getVoteEndTime(wipeDate) {
  return new Date(wipeDate.getTime() - 2 * 60 * 60 * 1000); // 2h avant
}

// --- Sauvegarde BDD ---
export async function saveWinningSeed(seed, wipeDate, voteData, voteCounts) {
  const connection = await getDbConnection();
  try {
    await connection.execute(
      `INSERT INTO active_seed (id, current_seed, map_size, next_wipe_date, wipe_type)
       VALUES (1, ?, ?, ?, 'biweekly')
       ON DUPLICATE KEY UPDATE
       current_seed = VALUES(current_seed),
       next_wipe_date = VALUES(next_wipe_date),
       updated_at = CURRENT_TIMESTAMP`,
      [seed.toString(), MAP_SIZE, DateTime.fromJSDate(wipeDate).toFormat('yyyy-MM-dd HH:mm:ss')]
    );

    await connection.execute(
      `INSERT INTO vote_history 
       (wipe_date, wipe_type, winner_seed, seed1, seed2, seed3, votes1, votes2, votes3, total_votes)
       VALUES (?, 'biweekly', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DateTime.fromJSDate(wipeDate).toFormat('yyyy-MM-dd HH:mm:ss'),
        seed.toString(),
        voteData.seeds[0].toString(),
        voteData.seeds[1].toString(),
        voteData.seeds[2].toString(),
        voteCounts[0],
        voteCounts[1],
        voteCounts[2],
        voteCounts.reduce((a, b) => a + b, 0)
      ]
    );

    logger.success("Winning seed saved to database", { seed, wipeDate });
  } catch (error) {
    logger.error("Error saving winning seed", { error: error.message });
    throw error;
  } finally {
    await connection.release();
  }
}

// --- Lancer le MapVote ---
export async function launchAutoMapVote(client, customDurationMinutes = null) {
  try {
    const channel = await client.channels.fetch(VOTE_CHANNEL_ID);
    if (!channel) return logger.error("Vote channel not found", { channelId: VOTE_CHANNEL_ID });

    const seeds = [generateRandomSeed(), generateRandomSeed(), generateRandomSeed()];
    logger.info("Generated random seeds", { seeds });

    await channel.send({ content: "🔄 Génération des maps en cours... Cela peut prendre jusqu'à 15 minutes." });

    await Promise.all(seeds.map(seed => createRustMap(seed)));

    let mapsData;
    try {
      mapsData = await waitForMapsGeneration(seeds);
    } catch {
      await channel.send({ content: "❌ Les maps n'ont pas pu être générées à temps." });
      return;
    }

    const wipeDate = getNextWipeDate();
    const voteEndTime = customDurationMinutes ? new Date(Date.now() + customDurationMinutes * 60 * 1000) : getVoteEndTime(wipeDate);

    const maps = seeds.map((seed, i) => buildMapData(mapsData[i], seed));
    const images = maps.map(m => m.imageUrl);
    const links = maps.map(m => m.mapUrl);

    const voteId = `auto_${Date.now()}`;
    activeVotes.set(voteId, { images, links, seeds, votes: [0, 0, 0], endTime: voteEndTime, channelId: channel.id, voteMessageId: null, isMapwipe: false, wipeDate });

    scheduleVoteEnd(voteId, voteEndTime);

    await sendAutoVoteMessages(channel, images, links, seeds, voteEndTime, wipeDate, voteId);

    logger.success("Auto MapVote launched", {
      voteId,
      seeds,
      wipeDate: DateTime.fromJSDate(wipeDate).toISO(),
      voteEndTime: DateTime.fromJSDate(voteEndTime).toISO()
    });

  } catch (error) {
    logger.error("Error launching auto MapVote", { error: error.message });
  }
}

// --- Embeds et messages ---
async function sendAutoVoteMessages(channel, images, links, seeds, endTime, wipeDate, voteId) {
  const commonUrl = "https://rustmaps.com";

  const announceEmbed = new EmbedBuilder()
    .setTitle("🌍 MAP VOTE !")
    .setColor(colors.BLUE)
    .setDescription("✅ Les maps sont prêtes ! Votez pour votre map préférée.")
    .addFields(
      { name: "🕐 Prochain wipe", value: `<t:${Math.floor(wipeDate.getTime() / 1000)}:F>`, inline: true },
      { name: "⏰ Fin du vote", value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`, inline: true }
    );

  await channel.send({ content: "@everyone", embeds: [announceEmbed], allowedMentions: { parse: ["everyone"] } });

  const embeds = [
    ...images.map((img, i) => new EmbedBuilder().setTitle(`Map ${i+1} - Seed: ${seeds[i]}`).setImage(img).setColor(colors.BLUE).setURL(commonUrl)),
    new EmbedBuilder().setImage("https://i.ibb.co/5XYzTvgs/Frame-49.png").setColor(colors.BLUE).setURL(commonUrl)
  ];

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Map 1").setStyle(ButtonStyle.Link).setURL(links[0]),
    new ButtonBuilder().setLabel("Map 2").setStyle(ButtonStyle.Link).setURL(links[1])
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Map 3").setStyle(ButtonStyle.Link).setURL(links[2])
  );

  await channel.send({ embeds, components: [row1, row2] });

  const voteEmbed = new EmbedBuilder()
    .setTitle("VOTEZ POUR LA PROCHAINE MAP")
    .setDescription("Cliquez sur les réactions pour voter pour votre map préférée :\n```\n1️⃣ → Map 1    2️⃣ → Map 2\n3️⃣ → Map 3\n```")
    .setColor(colors.BLUE);

  const voteMessage = await channel.send({ embeds: [voteEmbed] });
  const voteData = activeVotes.get(voteId);
  if (voteData) voteData.voteMessageId = voteMessage.id;

  for (const emoji of ["1️⃣", "2️⃣", "3️⃣"]) {
    await voteMessage.react(emoji);
    await new Promise(r => setTimeout(r, 200));
  }
}

// --- Scheduler ---
export function scheduleNextAutoMapVote(client) {
  const nextWipeDate = getNextWipeDate();
  const voteStartTime = getVoteStartTime(nextWipeDate);
  const now = new Date();
  const delay = voteStartTime.getTime() - now.getTime();

  if (delay > 0) {
    setTimeout(() => {
      launchAutoMapVote(client);
      scheduleNextAutoMapVote(client);
    }, delay);
    logger.info("Next auto MapVote scheduled", { voteStartTime: DateTime.fromJSDate(voteStartTime).toISO() });
  } else {
    logger.warn("Vote start time passed, launching immediately");
    launchAutoMapVote(client);
    scheduleNextAutoMapVote(client);
  }
}
