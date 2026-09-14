import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { warnMember } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Issue a warning to a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to warn').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the warning').setRequired(true)
    ),

  userPermissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
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
      const count = await warnMember(client, guild, target, moderator, reason);
      await interaction.editReply({
        embeds: [
          successEmbed(
            'Warning Issued',
            `${targetUser.tag} has been warned.\nReason: ${reason}\nTotal warnings: **${count}**`
          ),
        ],
      });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Failed', 'Could not issue warning.')] });
    }
  },
};

export default command;
