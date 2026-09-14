import {
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { BotClient } from '../../types/discord.js';
import { discordTimestamp } from '../../utils/time.js';
import { logger } from '../../utils/logger.js';

/** In-memory timers for active giveaways */
const giveawayTimers = new Map<string, NodeJS.Timeout>();

// ─── Embeds ───────────────────────────────────────────────────────────────────

export function buildGiveawayEmbed(
  prize: string,
  hostId: string,
  endsAt: Date,
  winnerCount: number,
  participantCount = 0,
  ended = false,
  winnerIds: string[] = []
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(ended ? 0x99aab5 : 0xf1c40f)
    .setTitle(`🎁 GIVEAWAY — ${prize}`)
    .setTimestamp(endsAt);

  if (ended) {
    if (winnerIds.length > 0) {
      embed.setDescription(`✅ **Terminé !**\n\n🏆 **Gagnant(s) :** ${winnerIds.map((id) => `<@${id}>`).join(', ')}`);
    } else {
      embed.setDescription('❌ Giveaway terminé — aucun participant valide.');
    }
  } else {
    embed.setDescription(
      [
        `🎉 Clique sur le bouton pour participer !`,
        ``,
        `👑 **Organisé par :** <@${hostId}>`,
        `🏆 **Gagnants :** ${winnerCount}`,
        `👥 **Participants :** ${participantCount}`,
        `⏰ **Fin :** ${discordTimestamp(endsAt, 'R')} (${discordTimestamp(endsAt, 'f')})`,
      ].join('\n')
    );
  }

  embed.setFooter({ text: ended ? 'Giveaway terminé' : 'BTCL Giveaway • Se termine le' });
  return embed;
}

export function buildGiveawayButton(ended = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_enter')
      .setLabel(ended ? 'Terminé' : '🎉 Participer')
      .setStyle(ended ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(ended)
  );
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createGiveaway(
  client: BotClient,
  channel: TextChannel,
  hostId: string,
  prize: string,
  winnerCount: number,
  durationMs: number
): Promise<string> {
  const endsAt = new Date(Date.now() + durationMs);

  // Ensure guild exists
  await prisma.guild.upsert({
    where: { id: channel.guild.id },
    create: { id: channel.guild.id, name: channel.guild.name },
    update: {},
  });

  // Send the embed
  const embed = buildGiveawayEmbed(prize, hostId, endsAt, winnerCount);
  const msg = await channel.send({
    embeds: [embed],
    components: [buildGiveawayButton()],
  });

  // Save to DB
  const giveaway = await prisma.giveaway.create({
    data: {
      guildId: channel.guild.id,
      channelId: channel.id,
      messageId: msg.id,
      hostId,
      prize,
      winnerCount,
      endsAt,
    },
  });

  // Schedule end
  scheduleGiveawayEnd(client, giveaway.id, durationMs);

  return giveaway.id;
}

// ─── End ──────────────────────────────────────────────────────────────────────

export async function endGiveaway(client: BotClient, giveawayId: string): Promise<void> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended || giveaway.cancelled) return;

  // Cancel timer if running
  const timer = giveawayTimers.get(giveawayId);
  if (timer) {
    clearTimeout(timer);
    giveawayTimers.delete(giveawayId);
  }

  // Fetch participants from button interactions
  const participants = await getParticipants(client, giveaway.channelId, giveaway.messageId ?? '');

  // Pick winners
  const winnerIds = pickWinners(participants, giveaway.winnerCount);

  // Update DB
  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { ended: true, winnerIds: JSON.stringify(winnerIds) },
  });

  // Update message
  await updateGiveawayMessage(client, giveaway.channelId, giveaway.messageId ?? '', {
    prize: giveaway.prize,
    hostId: giveaway.hostId,
    endsAt: giveaway.endsAt,
    winnerCount: giveaway.winnerCount,
    winnerIds,
    ended: true,
  });

  // Announce
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel | null;
  if (channel) {
    if (winnerIds.length > 0) {
      await channel.send({
        content: `🎉 Félicitations ${winnerIds.map((id) => `<@${id}>`).join(', ')} ! Vous avez gagné **${giveaway.prize}** !`,
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setDescription(`🏆 **Gagnant(s) du giveaway :** ${winnerIds.map((id) => `<@${id}>`).join(', ')}\n🎁 **Prix :** ${giveaway.prize}\n\nOrganisé par <@${giveaway.hostId}>`),
        ],
      });
    } else {
      await channel.send({ content: '❌ Pas assez de participants pour ce giveaway.' });
    }
  }
}

// ─── Reroll ───────────────────────────────────────────────────────────────────

export async function rerollGiveaway(client: BotClient, giveawayId: string): Promise<string[]> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || !giveaway.ended) throw new Error('Ce giveaway n\'est pas terminé.');

  const participants = await getParticipants(client, giveaway.channelId, giveaway.messageId ?? '');
  const newWinners = pickWinners(participants, giveaway.winnerCount);

  await prisma.giveaway.update({
    where: { id: giveawayId },
    data: { winnerIds: JSON.stringify(newWinners) },
  });

  return newWinners;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelGiveaway(client: BotClient, giveawayId: string): Promise<void> {
  const giveaway = await prisma.giveaway.findUnique({ where: { id: giveawayId } });
  if (!giveaway || giveaway.ended || giveaway.cancelled) throw new Error('Giveaway introuvable ou déjà terminé.');

  const timer = giveawayTimers.get(giveawayId);
  if (timer) { clearTimeout(timer); giveawayTimers.delete(giveawayId); }

  await prisma.giveaway.update({ where: { id: giveawayId }, data: { cancelled: true, ended: true } });

  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel | null;
  if (channel && giveaway.messageId) {
    const msg = await channel.messages.fetch(giveaway.messageId).catch(() => null);
    if (msg) {
      await msg.edit({
        embeds: [new EmbedBuilder().setColor(0xed4245).setTitle(`🎁 GIVEAWAY — ${giveaway.prize}`).setDescription('❌ Ce giveaway a été annulé.')],
        components: [buildGiveawayButton(true)],
      }).catch(() => {});
    }
  }
}

// ─── Restore on startup ───────────────────────────────────────────────────────

export async function restoreGiveaways(client: BotClient): Promise<void> {
  const activeGiveaways = await prisma.giveaway.findMany({
    where: { ended: false, cancelled: false },
  });

  for (const giveaway of activeGiveaways) {
    const remaining = giveaway.endsAt.getTime() - Date.now();
    if (remaining <= 0) {
      await endGiveaway(client, giveaway.id);
    } else {
      scheduleGiveawayEnd(client, giveaway.id, remaining);
    }
  }

  if (activeGiveaways.length > 0) {
    logger.info(`[Giveaway] Restored ${activeGiveaways.length} active giveaway(s)`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function scheduleGiveawayEnd(client: BotClient, giveawayId: string, ms: number): void {
  const timer = setTimeout(async () => {
    await endGiveaway(client, giveawayId).catch((err) => logger.error('[Giveaway] End error:', err));
    giveawayTimers.delete(giveawayId);
  }, ms);
  timer.unref();
  giveawayTimers.set(giveawayId, timer);
}

async function getParticipants(client: BotClient, channelId: string, messageId: string): Promise<string[]> {
  if (!messageId) return [];
  try {
    const entries = await prisma.giveawayEntry.findMany({ where: { messageId } });
    return entries.map((e) => e.userId).filter((id) => id !== client.user?.id);
  } catch {
    return [];
  }
}

function pickWinners(participants: string[], count: number): string[] {
  if (participants.length === 0) return [];
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, participants.length));
}

async function updateGiveawayMessage(
  client: BotClient,
  channelId: string,
  messageId: string,
  data: { prize: string; hostId: string; endsAt: Date; winnerCount: number; winnerIds: string[]; ended: boolean }
): Promise<void> {
  try {
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(messageId);
    await msg.edit({
      embeds: [buildGiveawayEmbed(data.prize, data.hostId, data.endsAt, data.winnerCount, 0, data.ended, data.winnerIds)],
      components: [buildGiveawayButton(true)],
    });
  } catch { /* message may have been deleted */ }
}

// ─── Participant count update ─────────────────────────────────────────────────

export async function updateParticipantCount(client: BotClient, messageId: string, channelId: string): Promise<void> {
  try {
    const giveaway = await prisma.giveaway.findFirst({ where: { messageId, ended: false } });
    if (!giveaway) return;

    const count = await prisma.giveawayEntry.count({ where: { messageId } });
    const channel = await client.channels.fetch(channelId) as TextChannel;
    const msg = await channel.messages.fetch(messageId);
    const embed = buildGiveawayEmbed(giveaway.prize, giveaway.hostId, giveaway.endsAt, giveaway.winnerCount, count);
    await msg.edit({ embeds: [embed], components: [buildGiveawayButton()] });
  } catch { /* ignore */ }
}
