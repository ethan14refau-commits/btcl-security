import { Events, Role, AuditLogEvent } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logRoleCreate } from '../services/logging/LogService.js';
import { NukeDetector } from '../services/antiNuke/NukeDetector.js';

const event: BotEvent<Events.GuildRoleCreate> = {
  name: Events.GuildRoleCreate,

  async execute(client: BotClient, role: Role): Promise<void> {
    await logRoleCreate(client, role);

    let actorId = 'unknown';
    try {
      const logs = await role.guild.fetchAuditLogs({ type: AuditLogEvent.RoleCreate, limit: 1 });
      const entry = logs.entries.first();
      if (entry) actorId = entry.executor?.id ?? 'unknown';
    } catch { /* ignore */ }

    await NukeDetector.getInstance().onEvent(client, role.guild.id, 'ROLE_CREATE', actorId);
  },
};

export default event;
