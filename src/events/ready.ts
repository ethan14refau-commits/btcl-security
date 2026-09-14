import { Events, ActivityType } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../database/client.js';
import { cacheGuildInvites } from '../services/inviteTracker/InviteTrackerService.js';
import { restoreGiveaways } from '../services/giveaway/GiveawayService.js';

const event: BotEvent<Events.ClientReady> = {
  name: Events.ClientReady,
  once: true,

  async execute(client: BotClient): Promise<void> {
    client.isReady = true;
    logger.info(`✅ Bot ready — logged in as ${client.user?.tag ?? 'unknown'}`);
    logger.info(`Connected to ${client.guilds.cache.size} guild(s)`);

    // Register all guilds in the database and cache invites
    for (const [, guild] of client.guilds.cache) {
      await prisma.guild.upsert({
        where: { id: guild.id },
        create: { id: guild.id, name: guild.name },
        update: { name: guild.name },
      });
      // Cache invites for invite tracker
      await cacheGuildInvites(guild);
    }

    // Restore active giveaways
    await restoreGiveaways(client);
    logger.info('[Giveaway] Active giveaways restored');

    // Cleanup expired verifications every 2 minutes
    const { cleanupExpiredVerifications } = await import('../services/verification/VerificationService.js');
    setInterval(() => {
      cleanupExpiredVerifications(client).catch((err) => logger.warn('[Verification] Cleanup error:', err));
    }, 2 * 60 * 1000);

    // Load saved bot activity from the first guild config that has one set
    // (activity is a global bot setting, stored per-owner config)
    try {
      const activityConfig = await prisma.guildConfig.findFirst({
        where: { botActivity: { not: null } },
        select: { botActivity: true },
      });

      if (activityConfig?.botActivity) {
        const activity = activityConfig.botActivity as {
          type: string;
          name: string;
          url?: string;
        };

        const typeMap: Record<string, ActivityType> = {
          PLAYING: ActivityType.Playing,
          STREAMING: ActivityType.Streaming,
          LISTENING: ActivityType.Listening,
          WATCHING: ActivityType.Watching,
          COMPETING: ActivityType.Competing,
        };

        client.user?.setActivity(activity.name, {
          type: typeMap[activity.type.toUpperCase()] ?? ActivityType.Watching,
          url: activity.url,
        });

        logger.info(`Bot activity set: ${activity.type} ${activity.name}`);
      }
    } catch (err) {
      logger.warn('Could not load saved bot activity:', err);
    }
  },
};

export default event;
