import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import {
  getAllOwners,
  addOwner,
  removeOwner,
  isBotOwner,
} from '../../database/repositories/OwnerRepository.js';
import { createSecurityEvent } from '../../database/repositories/SecurityEventRepository.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';
import { BotClient } from '../../types/discord.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('Manage Bot Owners (Bot Owner only)')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a new Bot Owner')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to add as owner').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a Bot Owner')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User to remove from owners').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all current Bot Owners')
    ),

  ownerOnly: true,

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const target = interaction.options.getUser('user', true);

      if (await isBotOwner(target.id)) {
        await interaction.reply({
          embeds: [errorEmbed('Already Owner', `${target.tag} is already a Bot Owner.`)],
          ephemeral: true,
        });
        return;
      }

      // Prevent self-removal later issues — but allow self-add for initial setup
      await addOwner(target.id, interaction.user.id);

      if (interaction.guildId) {
        await createSecurityEvent({
          guildId: interaction.guildId,
          type: 'OWNER_ADD',
          severity: 'HIGH',
          actorId: interaction.user.id,
          targetId: target.id,
          action: `Added ${target.tag} as Bot Owner`,
          details: { addedBy: interaction.user.tag, targetTag: target.tag },
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            'Owner Added',
            `${target.tag} (\`${target.id}\`) has been added as a **Bot Owner**.\n\n⚠️ They now have access to all sensitive bot commands.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('user', true);

      // Prevent removing self if they're the only owner
      if (target.id === interaction.user.id) {
        const owners = await getAllOwners();
        if (owners.length <= 1) {
          await interaction.reply({
            embeds: [
              errorEmbed(
                'Cannot Remove',
                'You cannot remove yourself as the only Bot Owner. Add another owner first.'
              ),
            ],
            ephemeral: true,
          });
          return;
        }
      }

      const removed = await removeOwner(target.id);
      if (!removed) {
        await interaction.reply({
          embeds: [errorEmbed('Not Found', `${target.tag} is not a Bot Owner.`)],
          ephemeral: true,
        });
        return;
      }

      if (interaction.guildId) {
        await createSecurityEvent({
          guildId: interaction.guildId,
          type: 'OWNER_REMOVE',
          severity: 'HIGH',
          actorId: interaction.user.id,
          targetId: target.id,
          action: `Removed ${target.tag} from Bot Owners`,
          details: { removedBy: interaction.user.tag, targetTag: target.tag },
        });
      }

      await interaction.reply({
        embeds: [
          successEmbed(
            'Owner Removed',
            `${target.tag} (\`${target.id}\`) has been removed from Bot Owners.`
          ),
        ],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const owners = await getAllOwners();

      if (owners.length === 0) {
        await interaction.reply({
          embeds: [infoEmbed('Bot Owners', 'No Bot Owners found in the database.\n\nCheck your `OWNER_IDS` environment variable.')],
          ephemeral: true,
        });
        return;
      }

      const ownerList = owners
        .map((o, i) => `${i + 1}. <@${o.userId}> (\`${o.userId}\`) — Added by \`${o.addedBy}\` on <t:${Math.floor(o.addedAt.getTime() / 1000)}:d>`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('👑 Bot Owners')
        .setDescription(ownerList)
        .setColor(0xf1c40f)
        .setFooter({ text: `${owners.length} owner(s) registered` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
