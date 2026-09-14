import { Events, GuildMember, TextChannel } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logMemberJoin } from '../services/logging/LogService.js';
import { RaidDetector } from '../services/antiRaid/RaidDetector.js';
import { ensureGuild } from '../database/repositories/GuildRepository.js';
import { applyAutoRoles } from '../services/autoRole/AutoRoleService.js';
import { detectUsedInvite } from '../services/inviteTracker/InviteTrackerService.js';
import { sendLog } from '../services/logging/LogService.js';
import { createEmbed } from '../utils/embeds.js';
import { prisma } from '../database/client.js';
import { getVerificationConfig, sendVerificationMessage } from '../services/verification/VerificationService.js';

const event: BotEvent<Events.GuildMemberAdd> = {
  name: Events.GuildMemberAdd,

  async execute(client: BotClient, member: GuildMember): Promise<void> {
    // Ensure guild is registered
    await ensureGuild(member.guild.id, member.guild.name);

    // Log the join
    await logMemberJoin(client, member);

    // Run anti-raid check
    await RaidDetector.getInstance().onMemberJoin(client, member);

    // ─── Verification system ────────────────────────────────────────────────
    const verifyConfig = await getVerificationConfig(member.guild.id);

    if (verifyConfig.enabled) {
      // Verification is active — send verification message and skip auto-roles
      // Auto-roles will be applied AFTER verification succeeds
      await sendVerificationMessage(client, member);
    } else {
      // No verification — apply auto-roles immediately as before
      await applyAutoRoles(member);
    }
    // ────────────────────────────────────────────────────────────────────────

    // Detect which invite was used
    const inviteInfo = await detectUsedInvite(member.guild, member);
    if (inviteInfo) {
      const embed = createEmbed(0x5865f2)
        .setTitle('📨 Invitation détectée')
        .addFields(
          { name: 'Nouveau membre', value: `${member.user.tag} (${member.id})`, inline: true },
          { name: 'Invité par', value: `<@${inviteInfo.inviterId}>`, inline: true },
          { name: 'Code', value: `\`${inviteInfo.code}\``, inline: true }
        );
      await sendLog(client, member.guild.id, embed);
    }

    // Welcome message (only shown if verification is disabled)
    if (!verifyConfig.enabled) {
      const config = await prisma.guildConfig.findUnique({ where: { guildId: member.guild.id } });
      if (config?.welcomeChannelId) {
        try {
          const channel = await client.channels.fetch(config.welcomeChannelId);
          if (channel?.isTextBased()) {
            await (channel as TextChannel).send(
              `🖤 **Bienvenue ${member.toString()} sur BTCL** 👑\n♠️ Prends ta place, respecte les règles et profite du serveur.\n🕷️ **Le BTCL t'attend.**`
            );
          }
        } catch { /* salon introuvable */ }
      }
    }
  },
};

export default event;
