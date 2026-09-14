import { BotClient } from '../../types/discord.js';
import { EventBuffer, NukeEventType } from './EventBuffer.js';
import { executeNukeAction } from './NukeAction.js';
import { getNukeThresholds } from '../../database/repositories/GuildRepository.js';
import { prisma } from '../../database/client.js';
import { createSecurityEvent } from '../../database/repositories/SecurityEventRepository.js';
import { logNukeDetected } from '../logging/LogService.js';
import { isIdWhitelisted } from '../whitelist/WhitelistService.js';
import { logger } from '../../utils/logger.js';

/** Cooldown per guild per event type to avoid repeat actions */
const actionCooldowns: Map<string, number> = new Map();
const COOLDOWN_MS = 30 * 1000;

export class NukeDetector {
  private static instance: NukeDetector;
  private buffer = EventBuffer.getInstance();

  private constructor() {}

  public static getInstance(): NukeDetector {
    if (!NukeDetector.instance) {
      NukeDetector.instance = new NukeDetector();
    }
    return NukeDetector.instance;
  }

  /**
   * Called whenever a potentially destructive Discord event occurs.
   */
  public async onEvent(
    client: BotClient,
    guildId: string,
    eventType: NukeEventType | string,
    actorId: string
  ): Promise<void> {
    // Check anti-nuke enabled
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config?.antinukeEnabled) return;

    // Push event into buffer
    this.buffer.push(guildId, eventType as NukeEventType, actorId);

    // Get thresholds
    const thresholds = await getNukeThresholds(guildId);
    const windowMs = thresholds.windowSeconds * 1000;

    // Map event type to threshold
    const thresholdMap: Record<string, number> = {
      CHANNEL_DELETE: thresholds.channelDelete,
      CHANNEL_CREATE: thresholds.channelCreate,
      ROLE_DELETE: thresholds.roleDelete,
      ROLE_CREATE: thresholds.roleCreate,
      BAN: thresholds.banCount,
      KICK: thresholds.kickCount,
      WEBHOOK_CREATE: thresholds.webhookCreate,
    };

    const threshold = thresholdMap[eventType];
    if (!threshold) return; // Event type not monitored

    // Check actor-specific count
    const count = this.buffer.countByActor(guildId, eventType as NukeEventType, actorId, windowMs);

    if (count < threshold) return;

    // Cooldown check
    const cooldownKey = `${guildId}:${eventType}:${actorId}`;
    const lastAction = actionCooldowns.get(cooldownKey) ?? 0;
    if (Date.now() - lastAction < COOLDOWN_MS) {
      logger.debug(`[Anti-Nuke] Cooldown active for ${cooldownKey}`);
      return;
    }
    actionCooldowns.set(cooldownKey, Date.now());

    // Check whitelist — still log, but skip action
    const isWhitelisted = await isIdWhitelisted(guildId, actorId);

    logger.warn(
      `[Anti-Nuke] ${isWhitelisted ? '[WHITELISTED - LOG ONLY]' : ''} ${eventType} x${count} by ${actorId} in guild ${guildId}`
    );

    // Always record the event
    await createSecurityEvent({
      guildId,
      type: 'NUKE_DETECTED',
      severity: 'CRITICAL',
      actorId,
      action: isWhitelisted
        ? `Logged only (whitelisted): ${eventType} x${count}`
        : `Action pending: ${eventType} x${count}`,
      details: { eventType, count, threshold, windowMs, whitelisted: isWhitelisted },
    });

    if (isWhitelisted) {
      await logNukeDetected(
        client,
        guildId,
        'this server',
        eventType,
        count,
        `<@${actorId}> (WHITELISTED)`,
        'LOG ONLY — actor is whitelisted'
      );
      return;
    }

    // Execute action
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      logger.error(`[Anti-Nuke] Guild ${guildId} not found in cache`);
      return;
    }

    // Get actor tag for logging
    let actorTag = actorId;
    try {
      const actor = await guild.members.fetch(actorId);
      actorTag = actor.user.tag;
    } catch { /* actor may have left */ }

    const result = await executeNukeAction(client, guild, actorId, eventType, count);

    await createSecurityEvent({
      guildId,
      type: 'NUKE_ACTION',
      severity: 'CRITICAL',
      actorId,
      action: result.action,
      details: { eventType, count, result },
    });

    await logNukeDetected(
      client,
      guildId,
      guild.name,
      eventType,
      count,
      actorTag,
      result.action
    );
  }
}
