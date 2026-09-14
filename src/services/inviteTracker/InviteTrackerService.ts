import { Guild, GuildMember, Invite } from 'discord.js';
import { prisma } from '../../database/client.js';
import { logger } from '../../utils/logger.js';

/** In-memory cache of invite uses per guild: Map<guildId, Map<code, uses>> */
const inviteCache: Map<string, Map<string, number>> = new Map();

/**
 * Cache all current invites for a guild.
 * Called on bot ready and when the bot joins a guild.
 */
export async function cacheGuildInvites(guild: Guild): Promise<void> {
  try {
    const invites = await guild.invites.fetch();
    const cache = new Map<string, number>();
    for (const [code, invite] of invites) {
      cache.set(code, invite.uses ?? 0);
    }
    inviteCache.set(guild.id, cache);
    logger.debug(`[InviteTracker] Cached ${invites.size} invites for ${guild.name}`);
  } catch {
    logger.warn(`[InviteTracker] Could not fetch invites for ${guild.name} — missing MANAGE_GUILD permission?`);
  }
}

/**
 * Detect which invite was used when a member joins.
 * Compares current invite uses against the cache.
 */
export async function detectUsedInvite(
  guild: Guild,
  member: GuildMember
): Promise<{ code: string; inviterId: string } | null> {
  try {
    const currentInvites = await guild.invites.fetch();
    const cachedInvites = inviteCache.get(guild.id) ?? new Map<string, number>();

    let usedInvite: Invite | null = null;

    for (const [, invite] of currentInvites) {
      const cachedUses = cachedInvites.get(invite.code) ?? 0;
      const currentUses = invite.uses ?? 0;
      if (currentUses > cachedUses) {
        usedInvite = invite;
        break;
      }
    }

    // Update cache with new uses
    const newCache = new Map<string, number>();
    for (const [code, invite] of currentInvites) {
      newCache.set(code, invite.uses ?? 0);
    }
    inviteCache.set(guild.id, newCache);

    if (!usedInvite || !usedInvite.inviter) return null;

    const inviterId = usedInvite.inviter.id;
    const code = usedInvite.code;

    // Persist to DB
    await prisma.inviteData.upsert({
      where: { guildId_inviteCode: { guildId: guild.id, inviteCode: code } },
      create: {
        guildId: guild.id,
        inviteCode: code,
        inviterId,
        uses: usedInvite.uses ?? 1,
      },
      update: { uses: usedInvite.uses ?? 1 },
    });

    await prisma.inviteJoin.create({
      data: {
        guildId: guild.id,
        joinerId: member.id,
        inviterId,
        inviteCode: code,
      },
    });

    return { code, inviterId };
  } catch (err) {
    logger.warn(`[InviteTracker] Could not detect invite for ${member.user.tag}: ${String(err)}`);
    return null;
  }
}

/**
 * Get invite stats for a user in a guild.
 */
export async function getInviteStats(guildId: string, userId: string): Promise<{
  total: number;
  joins: { joinerId: string; joinedAt: Date }[];
}> {
  const joins = await prisma.inviteJoin.findMany({
    where: { guildId, inviterId: userId },
    orderBy: { joinedAt: 'desc' },
    take: 20,
  });

  return {
    total: joins.length,
    joins: joins.map((j) => ({ joinerId: j.joinerId, joinedAt: j.joinedAt })),
  };
}

/**
 * Get the leaderboard of top inviters in a guild.
 */
export async function getInviteLeaderboard(guildId: string): Promise<
  { inviterId: string; count: number }[]
> {
  const results = await prisma.inviteJoin.groupBy({
    by: ['inviterId'],
    where: { guildId },
    _count: { inviterId: true },
    orderBy: { _count: { inviterId: 'desc' } },
    take: 10,
  });

  return results.map((r) => ({
    inviterId: r.inviterId,
    count: r._count.inviterId,
  }));
}
