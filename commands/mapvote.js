import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  SlashCommandBuilder,
} from "discord.js";
import { DateTime } from "luxon";
import fs from "fs/promises";
import { colors } from "../utils/colors.js";
import { activeVotes } from "../utils/discord.js";
import { scheduleVoteEnd } from "../utils/reactions.js";

// 🧪 MODE TEST - Changer à true pour activer le mode test (30 secondes)
const TEST_MODE = false;

export const mapvoteCommand = {
  data: new SlashCommandBuilder()
    .setName("mapvote")
    .setDescription(
      "Lance un vote de map pour le prochain wipe (Admin uniquement)"
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("image1")
        .setDescription("URL de l'image de la map 1")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("link1")
        .setDescription("Lien RustMaps de la map 1")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("seed1").setDescription("Seed de la map 1").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("image2")
        .setDescription("URL de l'image de la map 2")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("link2")
        .setDescription("Lien RustMaps de la map 2")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("seed2").setDescription("Seed de la map 2").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("image3")
        .setDescription("URL de l'image de la map 3")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("link3")
        .setDescription("Lien RustMaps de la map 3")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("seed3").setDescription("Seed de la map 3").setRequired(true)
    ),
  async execute(interaction) {
    const options = interaction.options;
    const images = [1, 2, 3].map((i) => options.getString(`image${i}`));
    const links = [1, 2, 3].map((i) => options.getString(`link${i}`));
    const seeds = [1, 2, 3].map((i) => options.getString(`seed${i}`));

    const now = new Date();

    // 🧪 Mode test : 30 secondes au lieu du prochain vendredi
    let endTime, wipeTime;
    if (TEST_MODE) {
      endTime = new Date(now.getTime() + 30 * 1000); // 30 secondes
      wipeTime = new Date(endTime.getTime() + 5 * 1000); // 5 secondes après la fin du vote
    } else {
      const nextFriday = getNextFriday17h();
      endTime = nextFriday;
      wipeTime = new Date(nextFriday.getTime() + 60 * 60 * 1000);
    }

    const voteId = interaction.id;
    activeVotes.set(voteId, {
      images,
      links,
      seeds,
      votes: [0, 0, 0, 0],
      endTime: endTime,
      channelId: interaction.channel.id,
      voteMessageId: null,
      testMode: TEST_MODE,
    });

    scheduleVoteEnd(voteId, endTime);

    const responseMessage = TEST_MODE
      ? "🧪 **MODE TEST** - MapVote lancé avec succès ! (se termine dans 30 secondes)"
      : "✅ MapVote lancé avec succès !";

    await interaction.reply({
      content: responseMessage,
      ephemeral: true,
    });
    await sendVoteMessages(
      interaction,
      images,
      links,
      seeds,
      endTime,
      wipeTime,
      voteId
    );
  },
};

// Fonction pour calculer le prochain vendredi à 17h
function getNextFriday17h() {
  const now = DateTime.now().setZone("Europe/Paris");
  let nextFriday = now
    .startOf("week")
    .plus({ days: 4 })
    .set({ hour: 17, minute: 0, second: 0 });

  // Si on est déjà passé le vendredi 17h cette semaine, prendre le vendredi suivant
  if (nextFriday <= now) {
    nextFriday = nextFriday.plus({ weeks: 1 });
  }

  return nextFriday.toJSDate();
}

async function sendVoteMessages(
  interaction,
  images,
  links,
  seeds,
  endTime,
  wipeTime,
  voteId
) {
  const channel = interaction.channel;
  const commonUrl = "https://winr8te.com";

  // 1. Annonce initiale
  const testModeIndicator = TEST_MODE ? "🧪 **MODE TEST** - " : "";
  const announceEmbed = new EmbedBuilder()
    .setTitle(`${testModeIndicator}🌍 MAP VOTE LANCÉ`)
    .setColor(TEST_MODE ? colors.YELLOW : colors.BLUE)
    .addFields(
      {
        name: TEST_MODE
          ? "🧪 Test - Prochain wipe"
          : "🕐 Prochain wipe (fullwipe)",
        value: `<t:${Math.floor(wipeTime.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: "⏰ Fin du vote",
        value: TEST_MODE
          ? `<t:${Math.floor(endTime.getTime() / 1000)}:R> **(30 secondes)**`
          : `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
        inline: true,
      }
    );

  await channel.send({
    content: "@everyone",
    embeds: [announceEmbed],
    allowedMentions: { parse: ["everyone"] },
  });

  // 2. Embeds de maps (3 maps + 1 image transparente pour l'alignement)
  const embeds = [
    ...images.map((img, i) =>
      new EmbedBuilder()
        .setImage(img)
        .setColor(TEST_MODE ? colors.YELLOW : colors.BLUE)
        .setURL(commonUrl)
    ),
    // Quatrième embed avec image transparente pour l'alignement 2x2
    new EmbedBuilder()
      .setImage("https://i.ibb.co/5XYzTvgs/Frame-49.png")
      .setColor(TEST_MODE ? colors.YELLOW : colors.BLUE)
      .setURL(commonUrl),
  ];

  // 3. Boutons
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Map 1")
      .setStyle(ButtonStyle.Link)
      .setURL(links[0]),
    new ButtonBuilder()
      .setLabel("Map 2")
      .setStyle(ButtonStyle.Link)
      .setURL(links[1])
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Map 3")
      .setStyle(ButtonStyle.Link)
      .setURL(links[2])
  );

  await channel.send({ embeds, components: [row1, row2] });

  // 4. Message de vote
  const voteEmbed = new EmbedBuilder()
    .setTitle(`${testModeIndicator}VOTEZ POUR LA PROCHAINE MAP`)
    .setDescription(
      `Cliquez sur les réactions pour voter pour votre map préférée :\n\n\`\`\`\n1️⃣ → Map 1    2️⃣ → Map 2\n3️⃣ → Map 3   \n\`\`\`${
        TEST_MODE
          ? "\n\n🧪 **MODE TEST ACTIVÉ** - Vote se termine dans 30 secondes"
          : ""
      }`
    )
    .setColor(TEST_MODE ? colors.YELLOW : colors.BLUE);

  const voteMessage = await channel.send({ embeds: [voteEmbed] });

  const voteData = activeVotes.get(voteId);
  if (voteData) voteData.voteMessageId = voteMessage.id;

  const emojis = ["1️⃣", "2️⃣", "3️⃣"];
  for (const emoji of emojis) {
    await voteMessage.react(emoji);
    await new Promise((res) => setTimeout(res, 200)); // Delay pour éviter le rate limit
  }
}
