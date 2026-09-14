import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import {
  addWhitelistEntry,
  removeWhitelistEntry,
  getWhitelistEntries,
} from '../../services/whitelist/WhitelistService.js';
import { createSecurityEvent } from '../../database/repositories/SecurityEventRepository.js';
import { logConfigChange } from '../../services/logging/LogService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { WhitelistType } from '../../types/discord.js';

const TYPE_LABELS: Record<string, string> = {
  USER: '👤 User',
  ROLE: '🏷️ Role',
  BOT: '🤖 Bot',
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage the security whitelist')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user, role, or bot to the whitelist')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User or bot to whitelist').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role to whitelist').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user or role from the whitelist')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to remove').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Role to remove').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all whitelist entries for this server')
    ),

  userPermissions: [PermissionFlagsBits.ManageGuild],
  ownerOnly: false,

  async execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (!user && !role) {
        await interaction.reply({ embeds: [errorEmbed('Missing Target', 'Please specify a user or role to whitelist.')], ephemeral: true });
        return;
      }

      if (user) {
        // Check if it's a bot
        const type: WhitelistType = user.bot ? 'BOT' : 'USER';
        await addWhitelistEntry(guildId, user.id, type, interaction.user.id);
        await createSecurityEvent({
          guildId,
          type: 'WHITELIST_ADD',
          severity: 'INFO',
          actorId: interaction.user.id,
          targetId: user.id,
          action: `Whitelisted ${type} ${user.tag}`,
          details: { targetTag: user.tag, type },
        });
        await logConfigChange(client, guildId, interaction.user, 'Whitelist Add', 'None', `${user.tag} (${type})`);
        await interaction.reply({
          embeds: [successEmbed('Whitelisted', `${user.tag} (${TYPE_LABELS[type]}) has been added to the whitelist.`)],
          ephemeral: true,
        });
      } else if (role) {
        await addWhitelistEntry(guildId, role.id, 'ROLE', interaction.user.id);
        await logConfigChange(client, guildId, interaction.user, 'Whitelist Add', 'None', `${role.name} (Role)`);
        await interaction.reply({
          embeds: [successEmbed('Whitelisted', `${role.name} (🏷️ Role) has been added to the whitelist.`)],
          ephemeral: true,
        });
      }
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (!user && !role) {
        await interaction.reply({ embeds: [errorEmbed('Missing Target', 'Please specify a user or role to remove.')], ephemeral: true });
        return;
      }

      const targetId = user?.id ?? role?.id;
      const targetName = user?.tag ?? role?.name ?? 'Unknown';

      const removed = await removeWhitelistEntry(guildId, targetId!);
      if (!removed) {
        await interaction.reply({ embeds: [errorEmbed('Not Found', `${targetName} is not on the whitelist.`)], ephemeral: true });
        return;
      }

      await createSecurityEvent({
        guildId,
        type: 'WHITELIST_REMOVE',
        severity: 'INFO',
        actorId: interaction.user.id,
        targetId: targetId,
        action: `Removed ${targetName} from whitelist`,
        details: { targetName },
      });

      await interaction.reply({
        embeds: [successEmbed('Removed', `${targetName} has been removed from the whitelist.`)],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const entries = await getWhitelistEntries(guildId);

      if (entries.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📝 Whitelist')
              .setDescription('The whitelist is empty.')
              .setColor(0x99aab5)
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }

      const list = entries
        .slice(0, 25)
        .map(
          (e) =>
            `${TYPE_LABELS[e.type] ?? e.type} <@${e.targetId}> (\`${e.targetId}\`) — Added <t:${Math.floor(e.addedAt.getTime() / 1000)}:R>`
        )
        .join('\n');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📝 Whitelist')
            .setDescription(list)
            .setColor(0x5865f2)
            .setFooter({ text: `${entries.length} entry/entries` })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
