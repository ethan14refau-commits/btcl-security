import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { banMember, ModerationError } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the ban').setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('delete_days')
        .setDescription('Number of days of messages to delete (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason');
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    const guild = interaction.guild!;
    const moderator = await guild.members.fetch(interaction.user.id);

    // Try to fetch as member (may not be in guild for ban by ID)
    let targetMember = null;
    try {
      targetMember = await guild.members.fetch(targetUser.id);
    } catch { /* user not in guild — can still ban */ }

    try {
      await banMember(client, guild, targetMember ?? targetUser, moderator, reason, deleteDays);
      await interaction.editReply({
        embeds: [successEmbed('Member Banned', `${targetUser.tag} has been banned.\nReason: ${reason ?? 'No reason provided'}`)],
      });
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Failed to ban user.';
      await interaction.editReply({ embeds: [errorEmbed('Ban Failed', message)] });
    }
  },
};

export default command;
