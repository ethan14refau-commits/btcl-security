import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { removetimeoutMember, ModerationError } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('untimeout')
    .setDescription('Remove timeout from a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to remove timeout from').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.ModerateMembers],
  botPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason');
    const guild = interaction.guild!;

    let target;
    try {
      target = await guild.members.fetch(targetUser.id);
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Not Found', 'This user is not in this server.')] });
      return;
    }

    if (!target.isCommunicationDisabled()) {
      await interaction.editReply({ embeds: [errorEmbed('Not Timed Out', 'This member is not currently timed out.')] });
      return;
    }

    const moderator = await guild.members.fetch(interaction.user.id);

    try {
      await removetimeoutMember(client, guild, target, moderator, reason);
      await interaction.editReply({
        embeds: [successEmbed('Timeout Removed', `${targetUser.tag}'s timeout has been removed.`)],
      });
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Failed to remove timeout.';
      await interaction.editReply({ embeds: [errorEmbed('Failed', message)] });
    }
  },
};

export default command;
