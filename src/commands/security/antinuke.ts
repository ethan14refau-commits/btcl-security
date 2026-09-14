import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { updateGuildConfig, getNukeThresholds } from '../../database/repositories/GuildRepository.js';
import { logConfigChange } from '../../services/logging/LogService.js';
import { successEmbed } from '../../utils/embeds.js';
import { prisma } from '../../database/client.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure Anti-Nuke protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('enable').setDescription('Enable Anti-Nuke protection')
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable Anti-Nuke protection')
    )
    .addSubcommand((sub) =>
      sub.setName('config').setDescription('View current Anti-Nuke configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('thresholds')
        .setDescription('Configure detection thresholds')
        .addIntegerOption((o) => o.setName('channel_delete').setDescription('Max channel deletions in window').setMinValue(1).setMaxValue(50))
        .addIntegerOption((o) => o.setName('role_delete').setDescription('Max role deletions in window').setMinValue(1).setMaxValue(50))
        .addIntegerOption((o) => o.setName('ban_count').setDescription('Max bans in window').setMinValue(1).setMaxValue(50))
        .addIntegerOption((o) => o.setName('window_seconds').setDescription('Detection window in seconds').setMinValue(5).setMaxValue(120))
    ),

  userPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      await updateGuildConfig(guildId, { antinukeEnabled: true });
      await logConfigChange(client, guildId, interaction.user, 'Anti-Nuke', 'Disabled', 'Enabled');
      await interaction.reply({ embeds: [successEmbed('Anti-Nuke Enabled', '☢️ Anti-Nuke protection is now **active**.')], ephemeral: true });
    }

    if (sub === 'disable') {
      await updateGuildConfig(guildId, { antinukeEnabled: false });
      await logConfigChange(client, guildId, interaction.user, 'Anti-Nuke', 'Enabled', 'Disabled');
      await interaction.reply({ embeds: [successEmbed('Anti-Nuke Disabled', 'Anti-Nuke protection has been disabled.')], ephemeral: true });
    }

    if (sub === 'config') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const thresholds = await getNukeThresholds(guildId);

      const embed = new EmbedBuilder()
        .setTitle('☢️ Anti-Nuke Configuration')
        .setColor(config?.antinukeEnabled ? 0x57f287 : 0xed4245)
        .addFields(
          { name: 'Status', value: config?.antinukeEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Detection Window', value: `${thresholds.windowSeconds}s`, inline: true },
          { name: '⠀', value: '⠀', inline: true },
          {
            name: 'Thresholds', value: [
              `• Channel deletions: **${thresholds.channelDelete}**`,
              `• Channel creations: **${thresholds.channelCreate}**`,
              `• Role deletions: **${thresholds.roleDelete}**`,
              `• Role creations: **${thresholds.roleCreate}**`,
              `• Bans: **${thresholds.banCount}**`,
              `• Kicks: **${thresholds.kickCount}**`,
              `• Webhook creations: **${thresholds.webhookCreate}**`,
            ].join('\n'), inline: false
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'thresholds') {
      const current = await getNukeThresholds(guildId);
      const updated = {
        ...current,
        channelDelete: interaction.options.getInteger('channel_delete') ?? current.channelDelete,
        roleDelete: interaction.options.getInteger('role_delete') ?? current.roleDelete,
        banCount: interaction.options.getInteger('ban_count') ?? current.banCount,
        windowSeconds: interaction.options.getInteger('window_seconds') ?? current.windowSeconds,
      };

      await updateGuildConfig(guildId, { antinukeThresholds: JSON.stringify(updated) });

      await interaction.reply({
        embeds: [successEmbed('Thresholds Updated', [
          `• Channel deletes: **${updated.channelDelete}** in **${updated.windowSeconds}s**`,
          `• Role deletes: **${updated.roleDelete}** in **${updated.windowSeconds}s**`,
          `• Bans: **${updated.banCount}** in **${updated.windowSeconds}s**`,
        ].join('\n'))],
        ephemeral: true,
      });
    }
  },
};

export default command;
