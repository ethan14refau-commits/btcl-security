import { GuildMember } from 'discord.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

/**
 * Assign all configured auto-roles to a new member.
 */
export async function applyAutoRoles(member: GuildMember): Promise<void> {
  const roles = await prisma.autoRole.findMany({
    where: { guildId: member.guild.id },
  });

  if (roles.length === 0) return;

  for (const entry of roles) {
    try {
      const role = member.guild.roles.cache.get(entry.roleId);
      if (!role) {
        logger.warn(`[AutoRole] Role ${entry.roleId} not found in guild ${member.guild.id} — skipping`);
        continue;
      }
      await member.roles.add(role, 'Auto-role on join');
    } catch (err) {
      logger.warn(`[AutoRole] Failed to add role ${entry.roleId} to ${member.user.tag}: ${String(err)}`);
    }
  }
}

/**
 * Add an auto-role for a guild.
 */
export async function addAutoRole(guildId: string, roleId: string): Promise<void> {
  await prisma.autoRole.upsert({
    where: { guildId_roleId: { guildId, roleId } },
    create: { guildId, roleId },
    update: {},
  });
}

/**
 * Remove an auto-role from a guild.
 */
export async function removeAutoRole(guildId: string, roleId: string): Promise<boolean> {
  try {
    await prisma.autoRole.delete({
      where: { guildId_roleId: { guildId, roleId } },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all auto-roles for a guild.
 */
export async function getAutoRoles(guildId: string): Promise<{ roleId: string }[]> {
  return prisma.autoRole.findMany({ where: { guildId } });
}
