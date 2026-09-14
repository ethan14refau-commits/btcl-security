import { Guild } from 'discord.js';
import { BotClient } from '../../types/discord.js';
import { logger } from '../../utils/logger.js';

export interface NukeActionResult {
  action: string;
  success: boolean;
  errors: string[];
}

/**
 * Apply anti-nuke response to the identified actor.
 * Strategy: timeout first (reversible), escalate if needed.
 */
export async function executeNukeAction(
  client: BotClient,
  guild: Guild,
  actorId: string,
  eventType: string,
  count: number
): Promise<NukeActionResult> {
  const result: NukeActionResult = {
    action: 'TIMEOUT',
    success: false,
    errors: [],
  };

  // Never act on bot itself
  if (actorId === client.user?.id) {
    result.action = 'SKIPPED (self)';
    result.success = true;
    return result;
  }

  try {
    const member = await guild.members.fetch(actorId);

    // Escalation: high count or certain event types → ban
    const shouldBan =
      count >= 10 ||
      eventType === 'BAN' ||
      eventType === 'ROLE_DELETE' ||
      eventType === 'CHANNEL_DELETE';

    if (shouldBan) {
      await guild.members.ban(member, {
        reason: `[Anti-Nuke] Mass ${eventType} detected — ${count} events`,
      });
      result.action = 'BAN';
    } else {
      // 24-hour timeout as reversible action
      await member.timeout(24 * 60 * 60 * 1000, `[Anti-Nuke] ${eventType} threshold exceeded — ${count} events`);
      result.action = 'TIMEOUT (24h)';
    }

    result.success = true;
    logger.warn(`[Anti-Nuke] Action ${result.action} applied to ${actorId} for ${eventType} (x${count}) in ${guild.name}`);
  } catch (err) {
    const msg = String(err);
    result.errors.push(msg);

    // Actor may have left already or be unhittable — try ban
    try {
      await guild.members.ban(actorId, {
        reason: `[Anti-Nuke] Mass ${eventType} detected — ${count} events`,
      });
      result.action = 'BAN (fallback)';
      result.success = true;
    } catch (banErr) {
      result.errors.push(`Ban also failed: ${String(banErr)}`);
      result.success = false;
    }
  }

  return result;
}
