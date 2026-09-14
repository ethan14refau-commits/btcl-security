import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { unlockChannel } from '../../services/moderation/ModerationService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock a previously locked channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to unlock (defaults to current)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for unlocking').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.ManageChannels],
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
    const reason = interaction.options.getString('reason');
    const moderator = await interaction.guild!.members.fetch(interaction.user.id);

    try {
      await unlockChannel(client, targetChannel, moderator, reason);

      await targetChannel.send({ embeds: [successEmbed('🔓 Channel Unlocked', `This channel has been unlocked by ${interaction.user.tag}.`)] });

      await interaction.editReply({
        embeds: [successEmbed('Channel Unlocked', `${targetChannel.toString()} has been unlocked.`)],
      });
    } catch {
      await interaction.editReply({ embeds: [errorEmbed('Failed', 'Could not unlock this channel.')] });
    }
  },
};

export default command;
