import { Events, GuildBan, AuditLogEvent } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logUnban } from '../services/logging/LogService.js';

const event: BotEvent<Events.GuildBanRemove> = {
  name: Events.GuildBanRemove,

  async execute(client: BotClient, ban: GuildBan): Promise<void> {
    let moderator = null;

    try {
      const auditLogs = await ban.guild.fetchAuditLogs({
        type: AuditLogEvent.MemberBanRemove,
        limit: 1,
      });
      const entry = auditLogs.entries.first();
      if (entry && entry.target?.id === ban.user.id) {
        moderator = entry.executor;
      }
    } catch {
      // Proceed without moderator info
    }

    await logUnban(client, ban.guild, ban.user, moderator);
  },
};

export default event;
