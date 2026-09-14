import { ChatInputCommandInteraction } from 'discord.js';
import { isBotOwner } from '../database/repositories/OwnerRepository.js';
import { errorEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware: ensures the interaction caller is a registered Bot Owner.
 *
 * Returns `true` if the user is an owner (command may proceed).
 * Returns `false` if not (already replied with error, command must abort).
 *
 * Never considers server roles, server ownership, or Administrator permission.
 */
export async function requireBotOwner(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const userId = interaction.user.id;

  const isOwner = await isBotOwner(userId);

  if (!isOwner) {
    logger.warn(
      `Unauthorized owner command attempt by ${interaction.user.tag} (${userId}) — command: ${interaction.commandName}`
    );

    await interaction.reply({
      embeds: [
        errorEmbed(
          'Access Denied',
          'This command is restricted to **Bot Owners** only.\n\nServer admins and guild owners do not have access to this command.'
        ),
      ],
      ephemeral: true,
    });

    return false;
  }

  return true;
}

/**
 * Standalone check — does not reply to any interaction.
 * Use for non-interaction contexts (API, services).
 */
export async function checkBotOwner(userId: string): Promise<boolean> {
  return isBotOwner(userId);
}
