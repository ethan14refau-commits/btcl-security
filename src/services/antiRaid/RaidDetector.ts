import { GuildMember, Message } from 'discord.js';
import { BotClient, RaidLevel } from '../../types/discord.js';
import { JoinTracker } from './JoinTracker.js';
import { executeRaidAction } from './RaidAction.js';
import { getRaidThresholds } from '../../database/repositories/GuildRepository.js';
import { prisma } from '../../database/client.js';
import { createSecurityEvent } from '../../database/repositories/SecurityEventRepository.js';
import { logRaidDetected } from '../logging/LogService.js';
import { isMemberWhitelisted } from '../whitelist/WhitelistService.js';
import { isNewAccount } from '../../utils/time.js';
import { logger } from '../../utils/logger.js';

/** Cooldown per guild to avoid spamming actions (ms) */
const ACTION_COOLDOWN_MS = 30 * 1000;

/** Track last action time per guild */
const lastActionTime: Map<string, number> = new Map();

export class RaidDetector {
  private static instance: RaidDetector;
  private tracker = JoinTracker.getInstance();

  private constructor() {}

  public static getInstance(): RaidDetector {
    if (!RaidDetector.instance) {
      RaidDetector.instance = new RaidDetector();
    }
    return RaidDetector.instance;
  }

  /**
   * Called on every guildMemberAdd event.
   */
  public async onMemberJoin(client: BotClient, member: GuildMember): Promise<void> {
    const guildId = member.guild.id;

    // Check anti-raid enabled
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config?.antiraidEnabled) return;

    // Check if member is whitelisted
    if (await isMemberWhitelisted(member)) {
      logger.debug(`[Anti-Raid] Whitelisted member joined: ${member.user.tag}`);
      return;
    }

    // Record the join
    this.tracker.recordJoin(guildId);

    // Get thresholds
    const thresholds = await getRaidThresholds(guildId);
    const level = config.antiraidLevel as RaidLevel;

    // Check windows
    const joins10s = this.tracker.getJoinsInWindow(guildId, 10 * 1000);
    const joins30s = this.tracker.getJoinsInWindow(guildId, 30 * 1000);
    const joins2m = this.tracker.getJoinsInWindow(guildId, 2 * 60 * 1000);

    // Check new account age
    const isNew = isNewAccount(member.id, thresholds.newAccountAgeDays * 24 * 60 * 60 * 1000);

    // Determine if raid threshold exceeded
    let triggered = false;
    let windowSeconds = 10;
    let joinCount = joins10s;

    if (joins10s >= thresholds.joins10s) {
      triggered = true;
      windowSeconds = 10;
      joinCount = joins10s;
    } else if (joins30s >= thresholds.joins30s) {
      triggered = true;
      windowSeconds = 30;
      joinCount = joins30s;
    } else if (joins2m >= thresholds.joins2m) {
      triggered = true;
      windowSeconds = 120;
      joinCount = joins2m;
    } else if (isNew && level !== 'LOW') {
      // New account joining while under scrutiny — flag but don't act unless threshold also hit
      logger.info(`[Anti-Raid] New account joined guild ${guildId}: ${member.user.tag} (account age < ${thresholds.newAccountAgeDays}d)`);
    }

    if (!triggered) return;

    // Cooldown check — avoid double-triggering
    const lastAction = lastActionTime.get(guildId) ?? 0;
    if (Date.now() - lastAction < ACTION_COOLDOWN_MS) {
      logger.debug(`[Anti-Raid] Cooldown active for guild ${guildId}, skipping action`);
      return;
    }
    lastActionTime.set(guildId, Date.now());

    // Fetch the members that joined in the window
    const windowMs = windowSeconds * 1000;
    const timestamps = this.tracker.getJoinTimestamps(guildId, windowMs);
    const membersInWindow: GuildMember[] = [];

    // Fetch recent members — try to get as many as possible
    try {
      const recentMembers = await member.guild.members.fetch({ limit: Math.min(joinCount * 2, 100) });
      const cutoff = Date.now() - windowMs;
      for (const [, m] of recentMembers) {
        if (m.joinedTimestamp && m.joinedTimestamp >= cutoff) {
          membersInWindow.push(m);
        }
      }
    } catch {
      // If we can't fetch, at least include the current member
      membersInWindow.push(member);
    }

    logger.warn(
      `[Anti-Raid] RAID DETECTED — Guild: ${member.guild.name} | ${joinCount} joins/${windowSeconds}s | Level: ${level}`
    );

    // Execute action
    const result = await executeRaidAction(
      client,
      member.guild,
      membersInWindow,
      level,
      joinCount,
      windowSeconds
    );

    // Log event
    await createSecurityEvent({
      guildId,
      type: 'RAID_DETECTED',
      severity: level === 'EXTREME' ? 'CRITICAL' : level === 'HIGH' ? 'HIGH' : 'MEDIUM',
      action: `${result.action} — ${result.affectedCount} members affected`,
      details: {
        joinCount,
        windowSeconds,
        level,
        affectedCount: result.affectedCount,
        errors: result.errors,
      },
    });

    await logRaidDetected(
      client,
      guildId,
      member.guild.name,
      joinCount,
      windowSeconds,
      result.action,
      membersInWindow.map((m) => m.id)
    );
  }

  /**
   * Called on every messageCreate event — checks for spam and mass mentions.
   */
  public async onMessage(client: BotClient, message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const config = await prisma.guildConfig.findUnique({ where: { guildId } });
    if (!config?.antiraidEnabled) return;

    const thresholds = await getRaidThresholds(guildId);

    this.tracker.recordMessage(guildId, message.author.id);

    // Spam detection: > N messages in 5 seconds from same user
    const msgCount = this.tracker.getMessagesInWindow(guildId, message.author.id, 5 * 1000);
    const mentionCount = message.mentions.users.size + message.mentions.roles.size;

    const spamThreshold = 7; // 7 messages in 5 seconds
    if (msgCount >= spamThreshold) {
      // Delete the message
      try {
        await message.delete();
      } catch { /* ignore */ }

      logger.info(`[Anti-Raid] Spam detected from ${message.author.tag} in ${message.guild.name}`);
      await createSecurityEvent({
        guildId,
        type: 'RAID_DETECTED',
        severity: 'MEDIUM',
        actorId: message.author.id,
        action: `Deleted spam message (${msgCount} msgs/5s)`,
        details: { userId: message.author.id, msgCount },
      });
    }

    // Mass mention detection
    if (mentionCount >= thresholds.mentionSpamCount) {
      try {
        await message.delete();
      } catch { /* ignore */ }

      logger.info(`[Anti-Raid] Mass mention detected from ${message.author.tag}: ${mentionCount} mentions`);
      await createSecurityEvent({
        guildId,
        type: 'RAID_DETECTED',
        severity: 'HIGH',
        actorId: message.author.id,
        action: `Deleted mass mention message (${mentionCount} mentions)`,
        details: { userId: message.author.id, mentionCount },
      });
    }
  }
}
