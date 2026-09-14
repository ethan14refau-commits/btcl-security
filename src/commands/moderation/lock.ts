import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { lockChannel } from '../../services/moderation/ModerationService.js';
import { logSecurityEvent } from '../../services/logging/LogService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock a channel — prevent members from sending messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to lock (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for locking').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString('reason');
    const moderator = await interaction.guild!.members.fetch(interaction.user.id);

    try {
      await lockChannel(client, targetChannel, moderator, reason);

      await logSecurityEvent(
        client,
        interaction.guildId!,
        'Channel Locked',
        `${targetChannel.name} locked by ${interaction.user.tag}`,
        'INFO',
        [{ name: 'Channel', value: targetChannel.toString(), inline: true },
         { name: 'Reason', value: reason ?? 'No reason provided', inline: true }]
      );

      await targetChannel.send({ embeds: [errorEmbed('🔒 Channel Locked', `This channel has been locked by ${interaction.user.tag}.\nReason: ${reason ?? 'No reason provided'}`)] });

      await interaction.editReply({
        embeds: [successEmbed('Channel Locked', `${targetChannel.toString()} has been locked.`)],
      });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Failed', 'Could not lock this channel.')] });
    }
  },
};

export default command;
