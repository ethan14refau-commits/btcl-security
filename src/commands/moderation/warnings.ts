import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { getUserCases } from '../../database/repositories/ModerationRepository.js';
import { errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to check').setRequired(true)
    ),

  userPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const guildId = interaction.guildId!;

    const cases = await getUserCases(guildId, targetUser.id);
    const warnings = cases.filter((c) => c.type === 'WARN');

    if (warnings.length === 0) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Warnings')
            .setDescription(`${targetUser.tag} has no warnings.`)
            .setColor(0x57f287)
            .setTimestamp(),
        ],
      });
      return;
    }

    const warnList = warnings
      .slice(0, 20) // Limit display to 20
      .map((w, i) =>
        `**#${i + 1}** — <t:${Math.floor(w.createdAt.getTime() / 1000)}:d>\n> ${w.reason ?? 'No reason'} (by \`${w.moderatorTag}\`)`
      )
      .join('\n');

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`⚠️ Warnings — ${targetUser.tag}`)
          .setDescription(warnList)
          .addFields({ name: 'Total Warnings', value: warnings.length.toString(), inline: true })
          .setColor(0xfee75c)
          .setTimestamp(),
      ],
    });
  },
};

export default command;
