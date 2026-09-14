import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { LockdownService } from '../../services/security/LockdownService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { parseDuration, formatDuration } from '../../utils/time.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock or unlock the server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Activate lockdown — deny @everyone from sending messages')
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
        .addStringOption((o) =>
          o.setName('duration').setDescription('Auto-unlock after (e.g. 30m, 2h). Omit for manual unlock.').setRequired(false)
        )
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Lock a single channel instead of the whole server')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('Deactivate lockdown — restore permissions')
        .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
        .addChannelOption((o) =>
          o
            .setName('channel')
            .setDescription('Unlock a single channel instead of the whole server')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  userPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild!;

    if (sub === 'start') {
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const durationStr = interaction.options.getString('duration');
      const channel = interaction.options.getChannel('channel');

      let durationMs = 0;
      if (durationStr) {
        const parsed = parseDuration(durationStr);
        if (!parsed) {
          await interaction.editReply({ embeds: [errorEmbed('Invalid Duration', 'Use format: 30m, 2h, 1d')] });
          return;
        }
        durationMs = parsed;
      }

      const count = await LockdownService.getInstance().activateLockdown(
        client,
        guild,
        `${interaction.user.tag}: ${reason}`,
        durationMs,
        channel?.id
      );

      const durationText = durationMs > 0 ? ` Auto-unlock in **${formatDuration(durationMs)}**.` : ' Manual unlock required.';

      await interaction.editReply({
        embeds: [
          successEmbed(
            '🔒 Lockdown Activated',
            `${channel ? `<#${channel.id}>` : `**${count}** channels`} locked.\nReason: ${reason}.${durationText}`
          ),
        ],
      });
    }

    if (sub === 'end') {
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      const channel = interaction.options.getChannel('channel');

      const count = await LockdownService.getInstance().deactivateLockdown(
        client,
        guild,
        `${interaction.user.tag}: ${reason}`,
        channel?.id
      );

      await interaction.editReply({
        embeds: [
          successEmbed(
            '🔓 Lockdown Lifted',
            `${channel ? `<#${channel.id}>` : `**${count}** channels`} unlocked.\nReason: ${reason}`
          ),
        ],
      });
    }
  },
};

export default command;
