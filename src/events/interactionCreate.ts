import {
  Events,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  InteractionType,
  PermissionResolvable,
} from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logger } from '../utils/logger.js';
import { errorEmbed } from '../utils/embeds.js';
import { requireBotOwner } from '../middleware/requireBotOwner.js';
import { memberHasPermissions, botHasPermissions } from '../utils/permissions.js';

const event: BotEvent<Events.InteractionCreate> = {
  name: Events.InteractionCreate,

  async execute(client: BotClient, interaction): Promise<void> {
    // Handle autocomplete
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const autocomplete = interaction as AutocompleteInteraction;
      const command = client.commands.get(autocomplete.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(autocomplete, client);
      } catch (err) {
        logger.error(`Autocomplete error for ${autocomplete.commandName}:`, err);
      }
      return;
    }

    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction as ChatInputCommandInteraction;

    const command = client.commands.get(cmd.commandName);
    if (!command) return;

    // Guild-only enforcement
    if (!cmd.guild || !cmd.member) {
      await cmd.reply({
        embeds: [errorEmbed('Guild Only', 'This command can only be used in a server.')],
        ephemeral: true,
      });
      return;
    }

    // Bot Owner check
    if (command.ownerOnly) {
      const allowed = await requireBotOwner(cmd);
      if (!allowed) return; // requireBotOwner already replied
    }

    // User permission check
    if (command.userPermissions?.length) {
      const member = await cmd.guild.members.fetch(cmd.user.id);
      if (!memberHasPermissions(member, command.userPermissions as PermissionResolvable[])) {
        await cmd.reply({
          embeds: [errorEmbed(
            'Missing Permissions',
            `You need the following permissions: ${command.userPermissions.join(', ')}`
          )],
          ephemeral: true,
        });
        return;
      }
    }

    // Bot permission check
    if (command.botPermissions?.length) {
      const botMember = await cmd.guild.members.fetchMe();
      if (!botHasPermissions(botMember, command.botPermissions as PermissionResolvable[])) {
        await cmd.reply({
          embeds: [errorEmbed(
            'Bot Missing Permissions',
            `I need the following permissions: ${command.botPermissions.join(', ')}`
          )],
          ephemeral: true,
        });
        return;
      }
    }

    // Execute command
    try {
      await command.execute(cmd, client);
    } catch (err) {
      logger.error(`Command error [${cmd.commandName}]:`, err);
      const embed = errorEmbed(
        'Command Error',
        'An unexpected error occurred. This has been logged.'
      );
      if (cmd.replied || cmd.deferred) {
        await cmd.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await cmd.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};

export default event;
