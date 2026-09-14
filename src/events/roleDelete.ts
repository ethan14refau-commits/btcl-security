import { Events, Role, AuditLogEvent } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logRoleDelete } from '../services/logging/LogService.js';
import { NukeDetector } from '../services/antiNuke/NukeDetector.js';

const event: BotEvent<Events.GuildRoleDelete> = {
  name: Events.GuildRoleDelete,

  async execute(client: BotClient, role: Role): Promise<void> {
    await logRoleDelete(client, role);

    let actorId = 'unknown';
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
      const entry = logs.entries.first();
      if (entry) actorId = entry.executor?.id ?? 'unknown';
    } catch { /* ignore */ }

    await NukeDetector.getInstance().onEvent(client, role.guild.id, 'ROLE_DELETE', actorId);
  },
};

export default event;
