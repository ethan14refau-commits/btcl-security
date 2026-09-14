import { GuildMember, Guild, TextChannel } from 'discord.js';
import { BotClient, RaidLevel } from '../../types/discord.js';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../database/client.js';
import { LockdownService } from '../security/LockdownService.js';

export type RaidActionType = 'LOG' | 'ALERT' | 'TIMEOUT' | 'KICK' | 'BAN' | 'LOCKDOWN';

export interface RaidActionResult {
  action: RaidActionType;
  affectedCount: number;
  errors: string[];
}

/**
 * Execute the appropriate anti-raid action based on the configured level.
 */
export async function executeRaidAction(
  client: BotClient,
  guild: Guild,
  members: GuildMember[],
  level: RaidLevel,
  joinCount: number,
  windowSeconds: number
): Promise<RaidActionResult> {
  const result: RaidActionResult = {
    action: 'LOG',
    affectedCount: 0,
    errors: [],
  };

  // Determine action based on level
  const actionMap: Record<RaidLevel, RaidActionType[]> = {
    LOW: ['LOG'],
    MEDIUM: ['LOG', 'ALERT'],
    HIGH: ['LOG', 'ALERT', 'TIMEOUT'],
    EXTREME: ['LOG', 'ALERT', 'BAN', 'LOCKDOWN'],
  };

  const actions = actionMap[level];
  result.action = actions[actions.length - 1]; // Most severe action

  // LOG — always
  logger.warn(`[ANTI-RAID] Guild: ${guild.name} | Level: ${level} | ${joinCount} joins/${windowSeconds}s | Members: ${members.length}`);

  // ALERT — send to log channel
  if (actions.includes('ALERT')) {
    try {
      const config = await prisma.guildConfig.findUnique({ where: { guildId: guild.id } });
      if (config?.logChannelId) {
        const ch = await client.channels.fetch(config.logChannelId);
        if (ch?.isTextBased()) {
          await (ch as TextChannel).send({
            content: `@here`,
            embeds: [{
              title: '🚨 RAID DETECTED',
              description: `**${joinCount}** joins in **${windowSeconds}s** — Level: **${level}**`,
              color: 0xff6600,
              timestamp: new Date().toISOString(),
            }],
          });
        }
      }
    } catch (e) {
      result.errors.push(`Alert failed: ${String(e)}`);
    }
  }

  // TIMEOUT — apply 1h timeout to all raid members
  if (actions.includes('TIMEOUT')) {
    const TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
    for (const member of members) {
      try {
        if (!member.isCommunicationDisabled()) {
          await member.timeout(TIMEOUT_MS, `[Anti-Raid] ${level} raid detected — ${joinCount} joins/${windowSeconds}s`);
          result.affectedCount++;
        }
      } catch (e) {
        result.errors.push(`Timeout ${member.id}: ${String(e)}`);
      }
    }
  }

  // KICK
  if (actions.includes('KICK')) {
    for (const member of members) {
      try {
        await member.kick(`[Anti-Raid] ${level} raid detected`);
        result.affectedCount++;
      } catch (e) {
        result.errors.push(`Kick ${member.id}: ${String(e)}`);
      }
    }
  }

  // BAN (EXTREME only)
  if (actions.includes('BAN')) {
    for (const member of members) {
      try {
        await guild.members.ban(member, { reason: `[Anti-Raid] EXTREME raid detected — ${joinCount} joins/${windowSeconds}s` });
        result.affectedCount++;
      } catch (e) {
        result.errors.push(`Ban ${member.id}: ${String(e)}`);
      }
    }
  }

  // LOCKDOWN
  if (actions.includes('LOCKDOWN')) {
    try {
      await LockdownService.getInstance().activateLockdown(
        client,
        guild,
        `[Anti-Raid] EXTREME raid detected — ${joinCount} joins in ${windowSeconds}s`,
        30 * 60 * 1000 // 30 minute auto-unlock
      );
    } catch (e) {
      result.errors.push(`Lockdown failed: ${String(e)}`);
    }
  }

  if (result.errors.length > 0) {
    logger.warn(`[ANTI-RAID] Errors during action: ${result.errors.join('; ')}`);
  }

  return result;
}
