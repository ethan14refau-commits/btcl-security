import { ChatInputCommandInteraction, PermissionResolvable } from 'discord.js';
import { errorEmbed } from '../utils/embeds.js';

/**
 * Middleware: checks that the interaction caller has specific guild permissions.
 * Returns true if allowed, false if denied (and already replied with error).
 */
export async function requireGuildPermission(
  interaction: ChatInputCommandInteraction,
  permissions: PermissionResolvable[]
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({
      embeds: [errorEmbed('Guild Only', 'This command can only be used in a server.')],
      ephemeral: true,
    });
    return false;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  const missing = permissions.filter((perm) => !member.permissions.has(perm));

  if (missing.length > 0) {
    await interaction.reply({
      embeds: [
        errorEmbed(
          'Missing Permissions',
          `You are missing the following permissions:\n${missing.map((p) => `• \`${String(p)}\``).join('\n')}`
        ),
      ],
      ephemeral: true,
    });
    return false;
  }

  return true;
}
