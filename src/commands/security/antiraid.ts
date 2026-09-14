import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient, RaidLevel } from '../../types/discord.js';
import { updateGuildConfig, getRaidThresholds } from '../../database/repositories/GuildRepository.js';
import { logConfigChange } from '../../services/logging/LogService.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { prisma } from '../../database/client.js';

const VALID_LEVELS: RaidLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'];

const LEVEL_DESCRIPTIONS: Record<RaidLevel, string> = {
  LOW: '🟢 LOG only',
  MEDIUM: '🟡 LOG + ALERT',
  HIGH: '🔴 LOG + ALERT + TIMEOUT members',
  EXTREME: '💀 LOG + ALERT + BAN + LOCKDOWN',
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure the Anti-Raid protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName('enable').setDescription('Enable Anti-Raid protection')
    )
    .addSubcommand((sub) =>
      sub.setName('disable').setDescription('Disable Anti-Raid protection')
    )
    .addSubcommand((sub) =>
      sub
        .setName('level')
        .setDescription('Set the Anti-Raid action level')
        .addStringOption((opt) =>
          opt
            .setName('level')
            .setDescription('Detection/action level')
            .setRequired(true)
            .addChoices(
              { name: '🟢 LOW — Log only', value: 'LOW' },
              { name: '🟡 MEDIUM — Log + Alert', value: 'MEDIUM' },
              { name: '🔴 HIGH — Log + Alert + Timeout', value: 'HIGH' },
              { name: '💀 EXTREME — Log + Alert + Ban + Lockdown', value: 'EXTREME' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub.setName('config').setDescription('View current Anti-Raid configuration')
    )
    .addSubcommand((sub) =>
      sub
        .setName('thresholds')
        .setDescription('Configure join thresholds')
        .addIntegerOption((o) => o.setName('joins_10s').setDescription('Max joins in 10 seconds').setMinValue(1).setMaxValue(100))
        .addIntegerOption((o) => o.setName('joins_30s').setDescription('Max joins in 30 seconds').setMinValue(1).setMaxValue(200))
        .addIntegerOption((o) => o.setName('joins_2m').setDescription('Max joins in 2 minutes').setMinValue(1).setMaxValue(500))
        .addIntegerOption((o) => o.setName('new_account_days').setDescription('Minimum account age in days').setMinValue(0).setMaxValue(365))
    ),

  userPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      await updateGuildConfig(guildId, { antiraidEnabled: true });
      await logConfigChange(client, guildId, interaction.user, 'Anti-Raid', 'Disabled', 'Enabled');
      await interaction.reply({ embeds: [successEmbed('Anti-Raid Enabled', '🛡️ Anti-Raid protection is now **active**.')], ephemeral: true });
    }

    if (sub === 'disable') {
      await updateGuildConfig(guildId, { antiraidEnabled: false });
      await logConfigChange(client, guildId, interaction.user, 'Anti-Raid', 'Enabled', 'Disabled');
      await interaction.reply({ embeds: [successEmbed('Anti-Raid Disabled', 'Anti-Raid protection has been disabled.')], ephemeral: true });
    }

    if (sub === 'level') {
      const level = interaction.options.getString('level', true) as RaidLevel;
      if (!VALID_LEVELS.includes(level)) {
        await interaction.reply({ embeds: [errorEmbed('Invalid Level', 'Use: LOW, MEDIUM, HIGH, or EXTREME.')], ephemeral: true });
        return;
      }
      const oldConfig = await prisma.guildConfig.findUnique({ where: { guildId } });
      await updateGuildConfig(guildId, { antiraidLevel: level });
      await logConfigChange(client, guildId, interaction.user, 'Anti-Raid Level', oldConfig?.antiraidLevel ?? 'MEDIUM', level);
      await interaction.reply({
        embeds: [successEmbed('Level Updated', `Anti-Raid level set to **${level}**\n${LEVEL_DESCRIPTIONS[level]}`)],
        ephemeral: true,
      });
    }

    if (sub === 'config') {
      const config = await prisma.guildConfig.findUnique({ where: { guildId } });
      const thresholds = await getRaidThresholds(guildId);
      const level = (config?.antiraidLevel ?? 'MEDIUM') as RaidLevel;

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Anti-Raid Configuration')
        .setColor(config?.antiraidEnabled ? 0x57f287 : 0xed4245)
        .addFields(
          { name: 'Status', value: config?.antiraidEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Level', value: `${level} — ${LEVEL_DESCRIPTIONS[level]}`, inline: true },
          { name: '⠀', value: '⠀', inline: true },
          { name: 'Join Thresholds', value: [
            `• 10 seconds: **${thresholds.joins10s}** joins → action`,
            `• 30 seconds: **${thresholds.joins30s}** joins → action`,
            `• 2 minutes: **${thresholds.joins2m}** joins → action`,
            `• New account age: **${thresholds.newAccountAgeDays}** days`,
            `• Mention spam: **${thresholds.mentionSpamCount}** mentions`,
          ].join('\n'), inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'thresholds') {
      const thresholds = await getRaidThresholds(guildId);
      const updated = {
        joins10s: interaction.options.getInteger('joins_10s') ?? thresholds.joins10s,
        joins30s: interaction.options.getInteger('joins_30s') ?? thresholds.joins30s,
        joins2m: interaction.options.getInteger('joins_2m') ?? thresholds.joins2m,
        newAccountAgeDays: interaction.options.getInteger('new_account_days') ?? thresholds.newAccountAgeDays,
        mentionSpamCount: thresholds.mentionSpamCount,
      };

      await updateGuildConfig(guildId, { raidThresholds: JSON.stringify(updated) });

      await interaction.reply({
        embeds: [successEmbed('Thresholds Updated', [
          `• 10s: **${updated.joins10s}** joins`,
          `• 30s: **${updated.joins30s}** joins`,
          `• 2m: **${updated.joins2m}** joins`,
          `• New accounts: **${updated.newAccountAgeDays}** days old`,
        ].join('\n'))],
        ephemeral: true,
      });
    }
  },
};

export default command;
