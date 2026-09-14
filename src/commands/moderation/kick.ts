import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { kickMember, ModerationError } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to kick').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the kick').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.KickMembers],
  botPermissions: [PermissionFlagsBits.KickMembers],

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

    const moderator = await guild.members.fetch(interaction.user.id);

    try {
      await kickMember(client, guild, target, moderator, reason);
      await interaction.editReply({
        embeds: [successEmbed('Member Kicked', `${targetUser.tag} has been kicked.\nReason: ${reason ?? 'No reason provided'}`)],
      });
    } catch (err) {
      const message = err instanceof ModerationError ? err.message : 'Failed to kick member.';
      await interaction.editReply({ embeds: [errorEmbed('Kick Failed', message)] });
    }
  },
};

export default command;
