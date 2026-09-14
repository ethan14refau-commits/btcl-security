import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { unbanUser, ModerationError } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) =>
      opt.setName('user_id').setDescription('User ID to unban').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the unban').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.BanMembers],
  botPermissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const userId = interaction.options.getString('user_id', true).trim();
    const reason = interaction.options.getString('reason');

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.editReply({ embeds: [errorEmbed('Invalid ID', 'Please provide a valid Discord user ID (17-20 digits).')] });
      return;
    }

    const moderator = await interaction.guild!.members.fetch(interaction.user.id);

    try {
      const user = await unbanUser(client, interaction.guild!, userId, moderator, reason);
      await interaction.editReply({
        embeds: [successEmbed('User Unbanned', `${user.tag} has been unbanned.\nReason: ${reason ?? 'No reason provided'}`)],
      });
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Failed to unban user.';
      await interaction.editReply({ embeds: [errorEmbed('Unban Failed', message)] });
    }
  },
};

export default command;
