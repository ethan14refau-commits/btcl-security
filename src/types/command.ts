import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  PermissionResolvable,
  AutocompleteInteraction,
} from 'discord.js';
import { BotClient } from './discord.js';

export interface Command {
  /** Slash command definition */
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

  /** Whether this command requires the caller to be a Bot Owner */
  ownerOnly?: boolean;

  /** Discord permissions required by the caller (guild member) */
  userPermissions?: PermissionResolvable[];

  /** Discord permissions required by the bot */
  botPermissions?: PermissionResolvable[];

  /** Main execution handler */
  execute(interaction: ChatInputCommandInteraction, client: BotClient): Promise<void>;

  /** Optional autocomplete handler */
  autocomplete?(interaction: AutocompleteInteraction, client: BotClient): Promise<void>;
}
