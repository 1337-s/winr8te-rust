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
    )
    .addStringOption((opt) =>
      opt
        .setName("image4")
        .setDescription("URL de l'image de la map 4")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("link4")
        .setDescription("Lien RustMaps de la map 4")
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("seed4").setDescription("Seed de la map 4").setRequired(true)
    ),
  async execute(interaction) {
    const options = interaction.options;
    const images = [1, 2, 3, 4].map((i) => options.getString(`image${i}`));
    const links = [1, 2, 3, 4].map((i) => options.getString(`link${i}`));
    const seeds = [1, 2, 3, 4].map((i) => options.getString(`seed${i}`));

    const now = new Date();
    const nextFriday = getNextFriday17h();
    const wipeTime = new Date(nextFriday.getTime() + 60 * 60 * 1000);

    const voteId = interaction.id;
    activeVotes.set(voteId, {
      images,
      links,
      seeds,
      votes: [0, 0, 0, 0],
      endTime: nextFriday,
      channelId: interaction.channel.id,
      voteMessageId: null,
    });

    scheduleVoteEnd(voteId, nextFriday);

    await interaction.reply({
      content: "✅ MapVote lancé avec succès !",
      ephemeral: true,
    });
    await sendVoteMessages(
      interaction,
      images,
      links,
      seeds,
      nextFriday,
      wipeTime,
      voteId
    );
  },
};

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
  const announceEmbed = new EmbedBuilder()
    .setTitle("🌍 MAP VOTE LANCÉ")
    .setColor(colors.BLUE)
    .addFields(
      {
        name: "🕐 Prochain wipe (fullwipe)",
        value: `<t:${Math.floor(wipeTime.getTime() / 1000)}:F>`,
        inline: true,
      },
      {
        name: "⏰ Fin du vote",
        value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>`,
        inline: true,
      }
    );

  await channel.send({
    content: "@everyone",
    embeds: [announceEmbed],
    allowedMentions: { parse: ["everyone"] },
  });

  // 2. Embeds de maps
  const embeds = images.map((img, i) =>
    new EmbedBuilder().setImage(img).setColor(colors.BLUE).setURL(commonUrl)
  );

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
      .setURL(links[2]),
    new ButtonBuilder()
      .setLabel("Map 4")
      .setStyle(ButtonStyle.Link)
      .setURL(links[3])
  );

  await channel.send({ embeds, components: [row1, row2] });

  // 4. Message de vote
  const voteEmbed = new EmbedBuilder()
    .setTitle("VOTEZ POUR LA PROCHAINE MAP")
    .setDescription(
      `Cliquez sur les réactions pour voter pour votre map préférée :\n\n\`\`\`\n1️⃣ → Map 1    2️⃣ → Map 2\n3️⃣ → Map 3    4️⃣ → Map 4\n\`\`\``
    )
    .setColor(colors.BLUE);

  const voteMessage = await channel.send({ embeds: [voteEmbed] });

  const voteData = activeVotes.get(voteId);
  if (voteData) voteData.voteMessageId = voteMessage.id;

  const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];
  for (const emoji of emojis) {
    await voteMessage.react(emoji);
    await new Promise((res) => setTimeout(res, 200)); // Delay pour éviter le rate limit
  }
}
