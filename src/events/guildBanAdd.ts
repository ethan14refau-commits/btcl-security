import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logBan } from '../services/logging/LogService.js';
import { NukeDetector } from '../services/antiNuke/NukeDetector.js';

const event: BotEvent<Events.GuildBanAdd> = {
  name: Events.GuildBanAdd,

  async execute(client: BotClient, ban: GuildBan): Promise<void> {
    // Try to get moderator from audit log
    let moderator = null;
    let reason = ban.reason;

    try {
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanAdd,
        limit: 1,
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === ban.user.id) {
        moderator = entry.executor;
        reason = reason ?? entry.reason;
      }
    } catch {
      // Audit log not accessible — proceed without moderator info
    }

    await logBan(client, ban.guild, ban.user, moderator, reason ?? null);

    // Anti-nuke: track mass bans
    await NukeDetector.getInstance().onEvent(client, ban.guild.id, 'BAN', moderator?.id ?? 'unknown');
  },
};

export default event;
