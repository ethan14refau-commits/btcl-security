import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { createCase } from '../../database/repositories/ModerationRepository.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete multiple messages from this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Only delete messages from this user').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for clearing').setRequired(false)
    ),

  userPermissions: [PermissionFlagsBits.ManageMessages],
  botPermissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const amount = interaction.options.getInteger('amount', true);
    const filterUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const channel = interaction.channel as TextChannel;

    if (!channel?.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed('Invalid Channel', 'This command can only be used in text channels.')] });
      return;
    }

    // Fetch messages
    const messages = await channel.messages.fetch({ limit: 100 });
    let toDelete = [...messages.values()].filter((m) => {
      // Discord only allows bulk-deleting messages < 14 days old
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      return m.createdTimestamp > twoWeeksAgo;
    });

    if (filterUser) {
      toDelete = toDelete.filter((m) => m.author.id === filterUser.id);
    }

    toDelete = toDelete.slice(0, amount);

    if (toDelete.length === 0) {
      await interaction.editReply({ embeds: [errorEmbed('No Messages', 'No eligible messages found to delete (messages older than 14 days cannot be bulk deleted).')] });
      return;
    }

    const deleted = await channel.bulkDelete(toDelete, true);

    await createCase({
      guildId: interaction.guildId!,
      type: 'CLEAR',
      targetId: channel.id,
      targetTag: `#${channel.name}`,
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
      reason: reason ?? undefined,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Messages Cleared',
          `Deleted **${deleted.size}** message(s) from ${channel.toString()}.${filterUser ? `\nFiltered to messages from ${filterUser.tag}.` : ''}`
        ),
      ],
    });
  },
};

export default command;
