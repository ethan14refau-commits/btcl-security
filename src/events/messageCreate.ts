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
import { TextChannel, ChannelType } from 'discord.js';
// ─── New features ─────────────────────────────────────────────────────────────
import { handleMessage as handleXP, getUserLevel, calculateLevel, xpForLevel, getLeaderboard, getRankPosition, getLevelConfig } from '../services/xp/XPService.js';
import { createGiveaway, endGiveaway, rerollGiveaway, cancelGiveaway, buildGiveawayEmbed, buildGiveawayButton, updateParticipantCount } from '../services/giveaway/GiveawayService.js';
import { createTicket, closeTicket, claimTicket, buildTicketPanelEmbed, buildTicketPanelButton, getTicketConfig } from '../services/ticket/TicketService.js';
import { prisma } from '../database/client.js';

const PREFIX = '+';

const event: BotEvent<Events.MessageCreate> = {
  name: Events.MessageCreate,

  async execute(client: BotClient, message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;

    // Anti-raid check
    await RaidDetector.getInstance().onMessage(client, message);

    // XP gain (before prefix check, all messages count)
    await handleXP(client, message).catch(() => {});

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
          { name: '🎁 Giveaways', value: '`+giveaway create/end/reroll/cancel/info`', inline: false },
          { name: '📊 XP', value: '`+rank` `+leaderboard` `+level`', inline: false },
          { name: '🎫 Tickets', value: '`+ticket` `+ticket setup/close/claim/add/remove/rename`', inline: false },
        )
        .setTimestamp();
      await reply(embed);
      return;
    }

    // ─── GIVEAWAY ──────────────────────────────────────────────────────────

    if (cmd === 'giveaway' || cmd === 'g') {
      const sub = args.shift()?.toLowerCase();

      if (sub === 'create' || sub === 'start') {
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
          return;
        }
        // +giveaway create <durée> <gagnants> <prix...>
        const durationStr = args.shift();
        const winnersStr = args.shift();
        const prize = args.join(' ');

        if (!durationStr || !winnersStr || !prize) {
          await reply(errorEmbed('Usage', '`+giveaway create <durée> <gagnants> <prix>`\nEx: `+giveaway create 1h 2 Nitro`'));
          return;
        }

        const durationMs = parseDuration(durationStr);
        if (!durationMs) { await reply(errorEmbed('Durée invalide', 'Utilise: 30s, 10m, 2h, 1d')); return; }

        const winnerCount = parseInt(winnersStr);
        if (isNaN(winnerCount) || winnerCount < 1 || winnerCount > 20) {
          await reply(errorEmbed('Gagnants invalides', 'Entre 1 et 20 gagnants.')); return;
        }

        try {
          const id = await createGiveaway(client, message.channel as TextChannel, message.author.id, prize, winnerCount, durationMs);
          await reply(successEmbed('Giveaway créé !', `Le giveaway pour **${prize}** a été lancé !\nID: \`${id.slice(0, 8)}\``));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'end') {
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
          return;
        }
        const id = args[0];
        if (!id) { await reply(errorEmbed('Usage', '`+giveaway end <id>`')); return; }

        const giveaway = await prisma.giveaway.findFirst({
          where: { guildId: guild.id, ended: false, OR: [{ id: { startsWith: id } }, { messageId: id }] },
        });
        if (!giveaway) { await reply(errorEmbed('Introuvable', 'Giveaway non trouvé ou déjà terminé.')); return; }

        await endGiveaway(client, giveaway.id);
        await reply(successEmbed('Giveaway terminé', `Le giveaway **${giveaway.prize}** a été terminé.`));
        return;
      }

      if (sub === 'reroll') {
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
          return;
        }
        const id = args[0];
        if (!id) { await reply(errorEmbed('Usage', '`+giveaway reroll <id>`')); return; }

        const giveaway = await prisma.giveaway.findFirst({
          where: { guildId: guild.id, ended: true, OR: [{ id: { startsWith: id } }, { messageId: id }] },
        });
        if (!giveaway) { await reply(errorEmbed('Introuvable', 'Giveaway non trouvé ou non terminé.')); return; }

        try {
          const newWinners = await rerollGiveaway(client, giveaway.id);
          if (newWinners.length > 0) {
            await message.channel.send(`🎉 Nouveau(x) gagnant(s) pour **${giveaway.prize}** : ${newWinners.map((id) => `<@${id}>`).join(', ')} !`);
            await reply(successEmbed('Reroll effectué', `Nouveaux gagnants : ${newWinners.map((id) => `<@${id}>`).join(', ')}`));
          } else {
            await reply(errorEmbed('Impossible', 'Pas assez de participants.'));
          }
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'cancel') {
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
          return;
        }
        const id = args[0];
        if (!id) { await reply(errorEmbed('Usage', '`+giveaway cancel <id>`')); return; }

        const giveaway = await prisma.giveaway.findFirst({
          where: { guildId: guild.id, ended: false, OR: [{ id: { startsWith: id } }, { messageId: id }] },
        });
        if (!giveaway) { await reply(errorEmbed('Introuvable', 'Giveaway non trouvé.')); return; }

        try {
          await cancelGiveaway(client, giveaway.id);
          await reply(successEmbed('Giveaway annulé', `Le giveaway **${giveaway.prize}** a été annulé.`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'info' || sub === 'list') {
        const giveaways = await prisma.giveaway.findMany({
          where: { guildId: guild.id, ended: false, cancelled: false },
          orderBy: { endsAt: 'asc' },
          take: 10,
        });

        if (giveaways.length === 0) {
          await reply(errorEmbed('Aucun giveaway', 'Il n\'y a aucun giveaway actif sur ce serveur.'));
          return;
        }

        const list = giveaways
          .map((g, i) => `**${i + 1}.** ${g.prize} — ${g.winnerCount} gagnant(s) — Fin : <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>\n   ID: \`${g.id.slice(0, 8)}\``)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(0xf1c40f)
          .setTitle('🎁 Giveaways actifs')
          .setDescription(list)
          .setTimestamp();
        await reply(embed);
        return;
      }

      await reply(errorEmbed('Usage', '`+giveaway create/end/reroll/cancel/info`'));
      return;
    }

    // ─── XP / RANK ─────────────────────────────────────────────────────────

    if (cmd === 'rank' || cmd === 'r') {
      const target = message.mentions.users.first() ?? message.author;
      const userLevel = await getUserLevel(guild.id, target.id);
      const rankPos = await getRankPosition(guild.id, target.id);
      const currentLevel = userLevel.level;
      const xpForNext = xpForLevel(currentLevel);
      let xpIntoLevel = userLevel.xp;
      for (let i = 0; i < currentLevel; i++) xpIntoLevel -= xpForLevel(i);

      const barFilled = Math.round((xpIntoLevel / xpForNext) * 10);
      const bar = '█'.repeat(barFilled) + '░'.repeat(10 - barFilled);

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📊 Rang — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: '🏆 Rang', value: `#${rankPos}`, inline: true },
          { name: '⭐ Niveau', value: `${currentLevel}`, inline: true },
          { name: '✉️ Messages', value: `${userLevel.messages}`, inline: true },
          { name: `XP [${bar}]`, value: `${xpIntoLevel} / ${xpForNext} XP`, inline: false },
          { name: '📈 XP Total', value: `${userLevel.xp}`, inline: true },
        )
        .setTimestamp();
      await reply(embed);
      return;
    }

    if (cmd === 'leaderboard' || cmd === 'lb' || cmd === 'top') {
      const entries = await getLeaderboard(guild.id, 10);

      if (entries.length === 0) {
        await reply(errorEmbed('Classement vide', 'Aucune donnée XP pour ce serveur.'));
        return;
      }

      const medals = ['🥇', '🥈', '🥉'];
      const list = await Promise.all(
        entries.map(async (e, i) => {
          const user = await client.users.fetch(e.userId).catch(() => null);
          return `${medals[i] ?? `**${i + 1}.**`} ${user?.tag ?? e.userId} — **Niv. ${e.level}** — ${e.xp} XP`;
        })
      );

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📊 Classement XP — ${guild.name}`)
        .setDescription(list.join('\n'))
        .setTimestamp();
      await reply(embed);
      return;
    }

    if (cmd === 'level' || cmd === 'xp') {
      const sub = args.shift()?.toLowerCase();

      if (!sub || sub === 'settings') {
        const config = await getLevelConfig(guild.id);
        const embed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('📊 Configuration XP')
          .addFields(
            { name: 'Statut', value: config.enabled ? '✅ Activé' : '❌ Désactivé', inline: true },
            { name: 'XP par message', value: `${config.xpPerMessage} (±5)`, inline: true },
            { name: 'Cooldown', value: `${config.xpCooldownSecs}s`, inline: true },
            { name: 'Salon level-up', value: config.levelUpChannelId ? `<#${config.levelUpChannelId}>` : 'Salon actuel', inline: true },
            { name: 'Récompenses', value: (() => {
              const roles = JSON.parse(config.levelRoles) as { level: number; roleId: string }[];
              return roles.length > 0 ? roles.map((r) => `Niv. ${r.level} → <@&${r.roleId}>`).join('\n') : 'Aucune';
            })(), inline: false },
          )
          .setTimestamp();
        await reply(embed);
        return;
      }

      if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
        return;
      }

      if (sub === 'enable' || sub === 'on') {
        await prisma.levelConfig.upsert({
          where: { guildId: guild.id },
          create: { guildId: guild.id, enabled: true },
          update: { enabled: true },
        });
        await reply(successEmbed('XP activé', 'Le système XP est maintenant actif.'));
        return;
      }

      if (sub === 'disable' || sub === 'off') {
        await prisma.levelConfig.upsert({
          where: { guildId: guild.id },
          create: { guildId: guild.id, enabled: false },
          update: { enabled: false },
        });
        await reply(successEmbed('XP désactivé', 'Le système XP est maintenant désactivé.'));
        return;
      }

      if (sub === 'setchannel') {
        const channel = message.mentions.channels.first();
        if (!channel) { await reply(errorEmbed('Usage', '`+level setchannel #salon`')); return; }
        await prisma.levelConfig.upsert({
          where: { guildId: guild.id },
          create: { guildId: guild.id, levelUpChannelId: channel.id },
          update: { levelUpChannelId: channel.id },
        });
        await reply(successEmbed('Salon défini', `Les level-up seront annoncés dans ${channel.toString()}.`));
        return;
      }

      if (sub === 'reward') {
        const action = args.shift()?.toLowerCase();
        const config = await getLevelConfig(guild.id);
        const roles = JSON.parse(config.levelRoles) as { level: number; roleId: string }[];

        if (action === 'add') {
          const lvl = parseInt(args[0]);
          const role = message.mentions.roles.first();
          if (isNaN(lvl) || !role) { await reply(errorEmbed('Usage', '`+level reward add <niveau> @role`')); return; }
          roles.push({ level: lvl, roleId: role.id });
          roles.sort((a, b) => a.level - b.level);
          await prisma.levelConfig.update({ where: { guildId: guild.id }, data: { levelRoles: JSON.stringify(roles) } });
          await reply(successEmbed('Récompense ajoutée', `Niveau ${lvl} → ${role.toString()}`));
        } else if (action === 'remove') {
          const lvl = parseInt(args[0]);
          if (isNaN(lvl)) { await reply(errorEmbed('Usage', '`+level reward remove <niveau>`')); return; }
          const filtered = roles.filter((r) => r.level !== lvl);
          await prisma.levelConfig.update({ where: { guildId: guild.id }, data: { levelRoles: JSON.stringify(filtered) } });
          await reply(successEmbed('Récompense retirée', `Récompense du niveau ${lvl} supprimée.`));
        } else if (action === 'list') {
          const list = roles.length > 0 ? roles.map((r) => `Niv. ${r.level} → <@&${r.roleId}>`).join('\n') : 'Aucune récompense configurée.';
          const embed = new EmbedBuilder().setColor(0x3498db).setTitle('🏆 Récompenses de niveau').setDescription(list).setTimestamp();
          await reply(embed);
        } else {
          await reply(errorEmbed('Usage', '`+level reward add/remove/list`'));
        }
        return;
      }

      await reply(errorEmbed('Usage', '`+level enable/disable/settings/setchannel/reward`'));
      return;
    }

    // ─── TICKETS ───────────────────────────────────────────────────────────

    if (cmd === 'ticket') {
      const sub = args.shift()?.toLowerCase();

      if (!sub || sub === 'open') {
        const subject = args.join(' ') || undefined;
        try {
          const ticketChannel = await createTicket(client, guild, member, subject);
          await reply(successEmbed('Ticket créé', `Ton ticket a été créé : ${ticketChannel.toString()}`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'panel') {
        if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin de **Gérer le serveur**.'));
          return;
        }
        await (message.channel as TextChannel).send({
          embeds: [buildTicketPanelEmbed()],
          components: [buildTicketPanelButton()],
        });
        await message.delete().catch(() => {});
        return;
      }

      if (sub === 'setup') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
          await reply(errorEmbed('Permission refusée', 'Tu as besoin d\'être **Administrateur**.'));
          return;
        }
        // +ticket setup <categorie> <role_support> [salon_logs]
        const category = message.mentions.channels.first() ??
          guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.id === args[0]);
        const supportRole = message.mentions.roles.first();
        const logChannel = message.mentions.channels.toJSON()[1] as TextChannel | undefined;

        await prisma.ticketConfig.upsert({
          where: { guildId: guild.id },
          create: {
            guildId: guild.id,
            enabled: true,
            categoryId: category?.id ?? null,
            supportRoleId: supportRole?.id ?? null,
            logChannelId: logChannel?.id ?? null,
          },
          update: {
            enabled: true,
            categoryId: category?.id ?? null,
            supportRoleId: supportRole?.id ?? null,
            logChannelId: logChannel?.id ?? null,
          },
        });

        await reply(successEmbed('Tickets configurés', [
          '✅ Système de tickets activé',
          category ? `📁 Catégorie : ${category.name}` : '',
          supportRole ? `👥 Rôle support : ${supportRole.toString()}` : '',
          logChannel ? `📜 Logs : ${logChannel.toString()}` : '',
        ].filter(Boolean).join('\n')));
        return;
      }

      if (sub === 'close') {
        const reason = args.join(' ') || undefined;
        try {
          await closeTicket(client, message.channel as TextChannel, member, reason);
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'claim') {
        try {
          await claimTicket(message.channel as TextChannel, member);
          await reply(successEmbed('Ticket pris en charge', `${member.toString()} a pris ce ticket en charge.`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'add') {
        const targetUser = message.mentions.members?.first();
        if (!targetUser) { await reply(errorEmbed('Usage', '`+ticket add @membre`')); return; }

        try {
          const ticket = await prisma.ticket.findUnique({ where: { channelId: message.channelId } });
          if (!ticket || ticket.status === 'CLOSED') { await reply(errorEmbed('Erreur', 'Ce salon n\'est pas un ticket actif.')); return; }

          await (message.channel as TextChannel).permissionOverwrites.create(targetUser, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
          });
          await reply(successEmbed('Membre ajouté', `${targetUser.toString()} a été ajouté au ticket.`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'remove') {
        const targetUser = message.mentions.members?.first();
        if (!targetUser) { await reply(errorEmbed('Usage', '`+ticket remove @membre`')); return; }

        try {
          const ticket = await prisma.ticket.findUnique({ where: { channelId: message.channelId } });
          if (!ticket) { await reply(errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')); return; }

          await (message.channel as TextChannel).permissionOverwrites.delete(targetUser);
          await reply(successEmbed('Membre retiré', `${targetUser.toString()} a été retiré du ticket.`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'rename') {
        const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (!newName) { await reply(errorEmbed('Usage', '`+ticket rename <nom>`')); return; }

        try {
          const ticket = await prisma.ticket.findUnique({ where: { channelId: message.channelId } });
          if (!ticket) { await reply(errorEmbed('Erreur', 'Ce salon n\'est pas un ticket.')); return; }

          await (message.channel as TextChannel).setName(newName);
          await reply(successEmbed('Ticket renommé', `Le salon a été renommé en **${newName}**.`));
        } catch (e) {
          await reply(errorEmbed('Erreur', String(e)));
        }
        return;
      }

      if (sub === 'list') {
        const tickets = await prisma.ticket.findMany({
          where: { guildId: guild.id, status: 'OPEN' },
          orderBy: { createdAt: 'desc' },
          take: 15,
        });

        if (tickets.length === 0) {
          await reply(errorEmbed('Aucun ticket', 'Il n\'y a aucun ticket ouvert.'));
          return;
        }

        const list = tickets
          .map((t) => `**#${t.number.toString().padStart(3, '0')}** <#${t.channelId}> — <@${t.userId}> — ${t.subject ?? 'Sans sujet'}`)
          .join('\n');

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle(`🎫 Tickets ouverts — ${tickets.length}`)
          .setDescription(list)
          .setTimestamp();
        await reply(embed);
        return;
      }

      await reply(errorEmbed('Usage', '`+ticket [open/close/claim/add/remove/rename/panel/setup/list]`'));
      return;
    }
  },
};

export default event;
