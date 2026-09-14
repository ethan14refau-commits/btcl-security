import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { timeoutMember, ModerationError } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { formatDuration } from '../../utils/time.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (mute for a duration)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to timeout').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('duration')
        .setDescription('Duration (e.g. 10m, 2h, 1d — max 28d)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the timeout').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const durationStr = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason');
    const guild = interaction.guild!;

    let target;
    try {
      target = await guild.members.fetch(targetUser.id);
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Not Found', 'This user is not in this server.')] });
      return;
    }

    const moderator = await guild.members.fetch(interaction.user.id);

    try {
      const ms = await timeoutMember(client, guild, target, moderator, durationStr, reason);
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Member Timed Out',
            `${targetUser.tag} has been timed out for **${formatDuration(ms)}**.\nReason: ${reason ?? 'No reason provided'}`
          ),
        ],
      });
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Failed to timeout member.';
      await interaction.editReply({ embeds: [errorEmbed('Timeout Failed', message)] });
    }
  },
};

export default command;
