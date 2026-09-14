import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { updateGuildConfig } from '../../database/repositories/GuildRepository.js';
import { logConfigChange } from '../../services/logging/LogService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { prisma } from '../../database/client.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Configure the log channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('channel')
        .setDescription('Set the channel where logs will be sent')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The text channel to send logs to')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable logging for this server')
    ),

  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({ embeds: [errorEmbed('Guild Only', 'This command requires a guild.')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel', true);

      // Verify bot can send messages in the channel
      const botMember = await interaction.guild!.members.fetchMe();
      const textChannel = await interaction.guild!.channels.fetch(channel.id);
      if (!textChannel?.isTextBased()) {
        await interaction.reply({ embeds: [errorEmbed('Invalid Channel', 'Please select a text channel.')], ephemeral: true });
        return;
      }

      const perms = textChannel.permissionsFor(botMember);
      if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms.has(PermissionFlagsBits.EmbedLinks)) {
        await interaction.reply({
          embeds: [errorEmbed('Missing Permissions', `I need **Send Messages** and **Embed Links** permissions in ${channel.toString()}.`)],
          ephemeral: true,
        });
        return;
      }

      // Get old value for log
      const oldConfig = await prisma.guildConfig.findUnique({ where: { guildId: interaction.guildId } });
      const oldChannelId = oldConfig?.logChannelId ?? 'None';

      await updateGuildConfig(interaction.guildId, { logChannelId: channel.id });

      await logConfigChange(
        client,
        interaction.guildId,
        interaction.user,
        'Log Channel',
        oldChannelId === 'None' ? 'None' : `<#${oldChannelId}>`,
        channel.toString()
      );

      await interaction.reply({
        embeds: [successEmbed('Log Channel Set', `Logs will now be sent to ${channel.toString()}.`)],
        ephemeral: true,
      });
    }

    if (sub === 'disable') {
      await updateGuildConfig(interaction.guildId, { logChannelId: null });

      await interaction.reply({
        embeds: [successEmbed('Logging Disabled', 'Log channel has been cleared. No more logs will be sent.')],
        ephemeral: true,
      });
    }
  },
};

export default command;
