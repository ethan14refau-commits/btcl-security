import { Events, Message, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { RaidDetector } from '../services/antiRaid/RaidDetector.js';
import { banMember, kickMember, timeoutMember, warnMember, unbanUser, lockChannel, unlockChannel, ModerationError } from '../services/moderation/ModerationService.js';
import { addAutoRole, removeAutoRole, getAutoRoles } from '../services/autoRole/AutoRoleService.js';
import { getInviteStats, getInviteLeaderboard } from '../services/inviteTracker/InviteTrackerService.js';
import { updateGuildConfig } from '../database/repositories/GuildRepository.js';
import { addWhitelistEntry, removeWhitelistEntry, getWhitelistEntries } from '../services/whitelist/WhitelistService.js';
import { LockdownService } from '../services/security/LockdownService.js';
import { isBotOwner } from '../database/repositories/OwnerRepository.js';
import { addOwner, removeOwner, getAllOwners } from '../database/repositories/OwnerRepository.js';
import { getUserCases } from '../database/repositories/ModerationRepository.js';
import { successEmbed, errorEmbed } from '../utils/embeds.js';
import { parseDuration, formatDuration } from '../utils/time.js';
import { TextChannel } from 'discord.js';

const PREFIX = '+';

const event: BotEvent<Events.MessageCreate> = {
  name: Events.MessageCreate,

  async execute(client: BotClient, message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    // Anti-raid check
    await RaidDetector.getInstance().onMessage(client, message);

    // Prefix command handler
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();
    if (!cmd) return;

    const guild = message.guild;
    const member = await guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    // Helper: reply with embed then delete the original command message
    const reply = async (embed: EmbedBuilder): Promise<void> => {
      await message.reply({ embeds: [embed] }).catch(() => {});
      await message.delete().catch(() => {});
    };

    // ─── MODERATION ────────────────────────────────────────────────────────

    if (cmd === 'ban') {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission de bannir.'));
        return;
      }
      const target = message.mentions.users.first();
      if (!target) { await reply(errorEmbed('Usage', '`+ban @user [raison]`')); return; }
      const reason = args.slice(1).join(' ') || null;
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      try {
        await banMember(client, guild, targetMember ?? target, member, reason);
        await reply(successEmbed('Banni', `${target.tag} a été banni.\nRaison : ${reason ?? 'Aucune'}`));
      } catch (e) {
        await reply(errorEmbed('Erreur', e instanceof ModerationError ? e.message : 'Impossible de bannir.'));
      }
      return;
    }

    if (cmd === 'unban') {
      if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission de débannir.'));
        return;
      }
      const userId = args[0];
      if (!userId || !/^\d{17,20}$/.test(userId)) { await reply(errorEmbed('Usage', '`+unban <user_id> [raison]`')); return; }
      const reason = args.slice(1).join(' ') || null;
      try {
        const user = await unbanUser(client, guild, userId, member, reason);
        await reply(successEmbed('Débanni', `${user.tag} a été débanni.`));
      } catch (e) {
        await reply(errorEmbed('Erreur', e instanceof ModerationError ? e.message : 'Impossible de débannir.'));
      }
      return;
    }

    if (cmd === 'kick') {
      if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission d\'expulser.'));
        return;
      }
      const target = message.mentions.members?.first();
      if (!target) { await reply(errorEmbed('Usage', '`+kick @user [raison]`')); return; }
      const reason = args.slice(1).join(' ') || null;
      try {
        await kickMember(client, guild, target, member, reason);
        await reply(successEmbed('Expulsé', `${target.user.tag} a été expulsé.\nRaison : ${reason ?? 'Aucune'}`));
      } catch (e) {
        await reply(errorEmbed('Erreur', e instanceof ModerationError ? e.message : 'Impossible d\'expulser.'));
      }
      return;
    }

    if (cmd === 'timeout' || cmd === 'mute') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission de mettre en timeout.'));
        return;
      }
      const target = message.mentions.members?.first();
      const duration = args[1];
      if (!target || !duration) { await reply(errorEmbed('Usage', '`+timeout @user <durée> [raison]` (ex: 10m, 2h, 1d)')); return; }
      const reason = args.slice(2).join(' ') || null;
      try {
        const ms = await timeoutMember(client, guild, target, member, duration, reason);
        await reply(successEmbed('Timeout', `${target.user.tag} a été mis en timeout pour **${formatDuration(ms)}**.\nRaison : ${reason ?? 'Aucune'}`));
      } catch (e) {
        await reply(errorEmbed('Erreur', e instanceof ModerationError ? e.message : 'Impossible de mettre en timeout.'));
      }
      return;
    }

    if (cmd === 'untimeout' || cmd === 'unmute') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission de retirer le timeout.'));
        return;
      }
      const target = message.mentions.members?.first();
      if (!target) { await reply(errorEmbed('Usage', '`+untimeout @user`')); return; }
      await target.timeout(null);
      await reply(successEmbed('Timeout retiré', `Le timeout de ${target.user.tag} a été retiré.`));
      return;
    }

    if (cmd === 'warn') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission d\'avertir.'));
        return;
      }
      const target = message.mentions.members?.first();
      const reason = args.slice(1).join(' ');
      if (!target || !reason) { await reply(errorEmbed('Usage', '`+warn @user <raison>`')); return; }
      try {
        const count = await warnMember(client, guild, target, member, reason);
        await reply(successEmbed('Avertissement', `${target.user.tag} a reçu un avertissement.\nRaison : ${reason}\nTotal : **${count}**`));
      } catch {
        await reply(errorEmbed('Erreur', 'Impossible d\'avertir.'));
      }
      return;
    }

    if (cmd === 'warnings') {
      if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const target = message.mentions.users.first() ?? message.author;
      const cases = await getUserCases(guild.id, target.id);
      const warns = cases.filter((c) => c.type === 'WARN');
      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Avertissements — ${target.username}`)
        .setDescription(warns.length === 0 ? 'Aucun avertissement.' : warns.slice(0, 10).map((w, i) => `**#${i + 1}** ${w.reason ?? 'Aucune raison'}`).join('\n'))
        .addFields({ name: 'Total', value: warns.length.toString(), inline: true })
        .setColor(0xfee75c)
        .setTimestamp();
      await reply(embed);
      return;
    }

    if (cmd === 'clear' || cmd === 'purge') {
      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await reply(errorEmbed('Permission refusée', 'Tu n\'as pas la permission de supprimer des messages.'));
        return;
      }
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount < 1 || amount > 100) { await reply(errorEmbed('Usage', '`+clear <1-100>`')); return; }
      const channel = message.channel as TextChannel;
      const deleted = await channel.bulkDelete(amount + 1, true);
      const confirmMsg = await channel.send({ embeds: [successEmbed('Supprimé', `${deleted.size - 1} message(s) supprimé(s).`)] });
      setTimeout(() => confirmMsg.delete().catch(() => {}), 3000);
      return;
    }

    if (cmd === 'lock') {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const reason = args.join(' ') || null;
      await lockChannel(client, message.channel as TextChannel, member, reason);
      await reply(successEmbed('🔒 Salon verrouillé', `Ce salon a été verrouillé.\nRaison : ${reason ?? 'Aucune'}`));
      return;
    }

    if (cmd === 'unlock') {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const reason = args.join(' ') || null;
      await unlockChannel(client, message.channel as TextChannel, member, reason);
      await reply(successEmbed('🔓 Salon déverrouillé', `Ce salon a été déverrouillé.`));
      return;
    }

    // ─── SECURITY ──────────────────────────────────────────────────────────

    if (cmd === 'lockdown') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      const reason = args.slice(1).join(' ') || 'Aucune raison';
      if (sub === 'start' || sub === 'on') {
        const count = await LockdownService.getInstance().activateLockdown(client, guild, `${message.author.tag}: ${reason}`);
        await reply(successEmbed('🔒 Lockdown activé', `${count} salon(s) verrouillé(s).\nRaison : ${reason}`));
      } else if (sub === 'end' || sub === 'off') {
        const count = await LockdownService.getInstance().deactivateLockdown(client, guild, `${message.author.tag}: ${reason}`);
        await reply(successEmbed('🔓 Lockdown levé', `${count} salon(s) déverrouillé(s).`));
      } else {
        await reply(errorEmbed('Usage', '`+lockdown start [raison]` ou `+lockdown end [raison]`'));
      }
      return;
    }

    if (cmd === 'antiraid') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      if (sub === 'enable' || sub === 'on') {
        await updateGuildConfig(guild.id, { antiraidEnabled: true });
        await reply(successEmbed('Anti-Raid activé', '🛡️ La protection Anti-Raid est maintenant active.'));
      } else if (sub === 'disable' || sub === 'off') {
        await updateGuildConfig(guild.id, { antiraidEnabled: false });
        await reply(successEmbed('Anti-Raid désactivé', 'La protection Anti-Raid a été désactivée.'));
      } else if (sub === 'level') {
        const level = args[1]?.toUpperCase();
        if (!['LOW', 'MEDIUM', 'HIGH', 'EXTREME'].includes(level ?? '')) {
          await reply(errorEmbed('Usage', '`+antiraid level <LOW|MEDIUM|HIGH|EXTREME>`'));
          return;
        }
        await updateGuildConfig(guild.id, { antiraidLevel: level });
        await reply(successEmbed('Niveau mis à jour', `Niveau Anti-Raid défini sur **${level}**.`));
      } else {
        await reply(errorEmbed('Usage', '`+antiraid enable/disable/level <niveau>`'));
      }
      return;
    }

    if (cmd === 'antinuke') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      if (sub === 'enable' || sub === 'on') {
        await updateGuildConfig(guild.id, { antinukeEnabled: true });
        await reply(successEmbed('Anti-Nuke activé', '☢️ La protection Anti-Nuke est maintenant active.'));
      } else if (sub === 'disable' || sub === 'off') {
        await updateGuildConfig(guild.id, { antinukeEnabled: false });
        await reply(successEmbed('Anti-Nuke désactivé', 'La protection Anti-Nuke a été désactivée.'));
      } else {
        await reply(errorEmbed('Usage', '`+antinuke enable/disable`'));
      }
      return;
    }

    if (cmd === 'whitelist') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      if (sub === 'add') {
        const target = message.mentions.users.first();
        if (!target) { await reply(errorEmbed('Usage', '`+whitelist add @user`')); return; }
        await addWhitelistEntry(guild.id, target.id, target.bot ? 'BOT' : 'USER', message.author.id);
        await reply(successEmbed('Whitelist', `${target.tag} a été ajouté à la whitelist.`));
      } else if (sub === 'remove') {
        const target = message.mentions.users.first();
        if (!target) { await reply(errorEmbed('Usage', '`+whitelist remove @user`')); return; }
        await removeWhitelistEntry(guild.id, target.id);
        await reply(successEmbed('Whitelist', `${target.tag} a été retiré de la whitelist.`));
      } else if (sub === 'list') {
        const entries = await getWhitelistEntries(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('📝 Whitelist')
          .setDescription(entries.length === 0 ? 'Aucune entrée.' : entries.map((e) => `<@${e.targetId}> (${e.type})`).join('\n'))
          .setColor(0x5865f2).setTimestamp();
        await reply(embed);
      } else {
        await reply(errorEmbed('Usage', '`+whitelist add/remove/list`'));
      }
      return;
    }

    // ─── CONFIGURATION ─────────────────────────────────────────────────────

    if (cmd === 'autorole') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      if (sub === 'add') {
        const role = message.mentions.roles.first();
        if (!role) { await reply(errorEmbed('Usage', '`+autorole add @role`')); return; }
        await addAutoRole(guild.id, role.id);
        await reply(successEmbed('Auto-Role', `${role.name} sera attribué à chaque nouveau membre.`));
      } else if (sub === 'remove') {
        const role = message.mentions.roles.first();
        if (!role) { await reply(errorEmbed('Usage', '`+autorole remove @role`')); return; }
        await removeAutoRole(guild.id, role.id);
        await reply(successEmbed('Auto-Role', `${role.name} retiré des auto-roles.`));
      } else if (sub === 'list') {
        const roles = await getAutoRoles(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('🎭 Auto-Roles')
          .setDescription(roles.length === 0 ? 'Aucun auto-role.' : roles.map((r) => `<@&${r.roleId}>`).join('\n'))
          .setColor(0x5865f2).setTimestamp();
        await reply(embed);
      } else {
        await reply(errorEmbed('Usage', '`+autorole add/remove/list`'));
      }
      return;
    }

    if (cmd === 'logs') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const channel = message.mentions.channels.first();
      if (!channel) { await reply(errorEmbed('Usage', '`+logs #salon`')); return; }
      await updateGuildConfig(guild.id, { logChannelId: channel.id });
      await reply(successEmbed('Logs', `Les logs seront envoyés dans ${channel.toString()}.`));
      return;
    }

    if (cmd === 'welcome') {
      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Permission insuffisante.'));
        return;
      }
      const channel = message.mentions.channels.first();
      if (!channel) { await reply(errorEmbed('Usage', '`+welcome #salon`')); return; }
      await updateGuildConfig(guild.id, { welcomeChannelId: channel.id });
      await reply(successEmbed('Bienvenue configuré', `Les messages de bienvenue seront envoyés dans ${channel.toString()}.`));
      return;
    }

    // ─── INVITES ───────────────────────────────────────────────────────────

    if (cmd === 'invites') {
      const target = message.mentions.users.first() ?? message.author;
      const stats = await getInviteStats(guild.id, target.id);
      const embed = new EmbedBuilder()
        .setTitle(`📨 Invitations — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields({ name: 'Total', value: `**${stats.total}** membre(s) invité(s)`, inline: false })
        .setColor(0x5865f2).setTimestamp();
      await reply(embed);
      return;
    }

    if (cmd === 'invitetop' || cmd === 'topinvites') {
      const leaderboard = await getInviteLeaderboard(guild.id);
      const medals = ['🥇', '🥈', '🥉'];
      const embed = new EmbedBuilder()
        .setTitle('📨 Top Inviters')
        .setDescription(leaderboard.length === 0 ? 'Aucune donnée.' : leaderboard.map((e, i) => `${medals[i] ?? `**${i + 1}.**`} <@${e.inviterId}> — **${e.count}** invitation(s)`).join('\n'))
        .setColor(0xf1c40f).setTimestamp();
      await reply(embed);
      return;
    }

    // ─── OWNER ─────────────────────────────────────────────────────────────

    if (cmd === 'owner') {
      const isOwner = await isBotOwner(message.author.id);
      if (!isOwner) {
        await reply(errorEmbed('Accès refusé', 'Cette commande est réservée aux Bot Owners.'));
        return;
      }
      const sub = args[0]?.toLowerCase();
      if (sub === 'add') {
        const target = message.mentions.users.first();
        if (!target) { await reply(errorEmbed('Usage', '`+owner add @user`')); return; }
        await addOwner(target.id, message.author.id);
        await reply(successEmbed('Owner ajouté', `${target.tag} est maintenant Bot Owner.`));
      } else if (sub === 'remove') {
        const target = message.mentions.users.first();
        if (!target) { await reply(errorEmbed('Usage', '`+owner remove @user`')); return; }
        await removeOwner(target.id);
        await reply(successEmbed('Owner retiré', `${target.tag} n'est plus Bot Owner.`));
      } else if (sub === 'list') {
        const owners = await getAllOwners();
        const embed = new EmbedBuilder()
          .setTitle('👑 Bot Owners')
          .setDescription(owners.map((o, i) => `${i + 1}. <@${o.userId}>`).join('\n'))
          .setColor(0xf1c40f).setTimestamp();
        await reply(embed);
      } else {
        await reply(errorEmbed('Usage', '`+owner add/remove/list`'));
      }
      return;
    }

    // ─── HELP ──────────────────────────────────────────────────────────────

    if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📋 Commandes — Préfixe `+`')
        .setColor(0x5865f2)
        .addFields(
          { name: '🔨 Modération', value: '`+ban` `+unban` `+kick` `+timeout` `+untimeout` `+warn` `+warnings` `+clear` `+lock` `+unlock`', inline: false },
          { name: '🛡️ Sécurité', value: '`+antiraid` `+antinuke` `+whitelist` `+lockdown`', inline: false },
          { name: '⚙️ Configuration', value: '`+autorole` `+logs`', inline: false },
          { name: '📨 Invitations', value: '`+invites` `+invitetop`', inline: false },
          { name: '👑 Owner', value: '`+owner`', inline: false },
        )
        .setTimestamp();
      await reply(embed);
      return;
    }
  },
};

export default event;
