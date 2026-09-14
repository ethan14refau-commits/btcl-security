import {
  Guild,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  OverwriteType,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { BotClient } from '../../types/discord.js';
import { logger } from '../../utils/logger.js';

/** Get or create TicketConfig for a guild */
async function getTicketConfig(guildId: string) {
  let config = await prisma.ticketConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.ticketConfig.create({ data: { guildId } });
  }
  return config;
}

/** Get next ticket number for a guild */
async function getNextTicketNumber(guildId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({
    where: { guildId },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/** Build the ticket panel embed */
export function buildTicketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle('🎫 Support BTCL')
    .setDescription(
      'Clique sur le bouton ci-dessous pour créer un ticket de support.\nNotre équipe te répondra dans les plus brefs délais.'
    )
    .setFooter({ text: '🖤 BTCL Support' })
    .setTimestamp();
}

export function buildTicketPanelButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_create')
      .setLabel('🎫 Créer un ticket')
      .setStyle(ButtonStyle.Success)
  );
}

/** Build the in-ticket control buttons */
export function buildTicketControlButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 Fermer').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('📌 Prendre en charge').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket_transcript').setLabel('📄 Transcript').setStyle(ButtonStyle.Secondary)
  );
}

/** Create a new ticket channel */
export async function createTicket(
  client: BotClient,
  guild: Guild,
  member: GuildMember,
  subject?: string
): Promise<TextChannel> {
  const config = await getTicketConfig(guild.id);

  if (!config.enabled) throw new Error('Le système de tickets n\'est pas activé sur ce serveur. Utilise `+ticket setup`.');

  // Check max open tickets per user
  const openTickets = await prisma.ticket.count({
    where: { guildId: guild.id, userId: member.id, status: 'OPEN' },
  });
  if (openTickets >= config.maxOpenPerUser) {
    throw new Error(`Tu as déjà ${openTickets} ticket(s) ouvert(s). Ferme-les avant d'en créer un nouveau.`);
  }

  const number = await getNextTicketNumber(guild.id);
  const channelName = `ticket-${number.toString().padStart(3, '0')}`;

  // Build permission overwrites
  const permissionOverwrites: import('discord.js').OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  // Add bot
  const botMember = await guild.members.fetchMe();
  permissionOverwrites.push({
    id: botMember.id,
    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ReadMessageHistory],
  });

  // Add support role
  if (config.supportRoleId) {
    permissionOverwrites.push({
      id: config.supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    });
  }

  // Create channel
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.categoryId ?? undefined,
    permissionOverwrites,
    topic: `Ticket de ${member.user.tag} | ${subject ?? 'Support'}`,
  });

  // Save to DB
  await prisma.guild.upsert({
    where: { id: guild.id },
    create: { id: guild.id, name: guild.name },
    update: {},
  });

  await prisma.ticket.create({
    data: {
      guildId: guild.id,
      channelId: channel.id,
      userId: member.id,
      number,
      subject: subject ?? null,
    },
  });

  // Send welcome embed in ticket
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle(`🎫 Ticket #${number.toString().padStart(3, '0')}`)
    .setDescription(
      [
        `Bienvenue ${member.toString()} !`,
        ``,
        `Décris ton problème et notre équipe te répondra.`,
        subject ? `\n**Sujet :** ${subject}` : '',
        ``,
        `Utilise les boutons ci-dessous pour gérer ce ticket.`,
      ].join('\n')
    )
    .addFields(
      { name: '👤 Créé par', value: member.toString(), inline: true },
      { name: '🕒 Créé le', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true }
    )
    .setFooter({ text: '🖤 BTCL Support' })
    .setTimestamp();

  await (channel as TextChannel).send({
    content: `${member.toString()}${config.supportRoleId ? ` <@&${config.supportRoleId}>` : ''}`,
    embeds: [embed],
    components: [buildTicketControlButtons()],
  });

  logger.info(`[Ticket] Created ticket #${number} for ${member.user.tag} in ${guild.name}`);
  return channel as TextChannel;
}

/** Close a ticket */
export async function closeTicket(
  client: BotClient,
  channel: TextChannel,
  closedBy: GuildMember,
  reason?: string
): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { channelId: channel.id } });
  if (!ticket) throw new Error('Ce salon n\'est pas un ticket.');
  if (ticket.status === 'CLOSED') throw new Error('Ce ticket est déjà fermé.');

  const config = await getTicketConfig(ticket.guildId);

  // Generate transcript
  const transcript = await generateTranscript(channel);

  // Update DB
  await prisma.ticket.update({
    where: { channelId: channel.id },
    data: { status: 'CLOSED', closedAt: new Date() },
  });

  // Send log
  if (config.logChannelId) {
    const logChannel = await client.channels.fetch(config.logChannelId).catch(() => null) as TextChannel | null;
    if (logChannel) {
      const logEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`📋 Ticket #${ticket.number.toString().padStart(3, '0')} fermé`)
        .addFields(
          { name: '👤 Créé par', value: `<@${ticket.userId}>`, inline: true },
          { name: '🔒 Fermé par', value: closedBy.toString(), inline: true },
          { name: '📌 Pris en charge par', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Personne', inline: true },
          { name: '📅 Créé le', value: `<t:${Math.floor(ticket.createdAt.getTime() / 1000)}:f>`, inline: true },
          { name: '🔒 Fermé le', value: `<t:${Math.floor(Date.now() / 1000)}:f>`, inline: true },
          { name: '📝 Raison', value: reason ?? 'Aucune raison fournie', inline: false },
        )
        .setTimestamp();

      await logChannel.send({
        embeds: [logEmbed],
        files: transcript ? [{ name: `ticket-${ticket.number}.txt`, attachment: Buffer.from(transcript) }] : [],
      });
    }
  }

  // Delete channel after delay
  await channel.send({
    embeds: [new EmbedBuilder().setColor(0xed4245).setDescription('🔒 Ce ticket va être supprimé dans **5 secondes**...')],
  });

  setTimeout(async () => {
    await channel.delete(`Ticket fermé par ${closedBy.user.tag}: ${reason ?? 'Aucune raison'}`).catch(() => {});
  }, 5000);
}

/** Claim a ticket */
export async function claimTicket(channel: TextChannel, staff: GuildMember): Promise<void> {
  const ticket = await prisma.ticket.findUnique({ where: { channelId: channel.id } });
  if (!ticket) throw new Error('Ce salon n\'est pas un ticket.');
  if (ticket.status === 'CLOSED') throw new Error('Ce ticket est fermé.');
  if (ticket.claimedBy) throw new Error(`Ce ticket est déjà pris en charge par <@${ticket.claimedBy}>.`);

  await prisma.ticket.update({
    where: { channelId: channel.id },
    data: { claimedBy: staff.id },
  });
}

/** Generate a simple text transcript */
async function generateTranscript(channel: TextChannel): Promise<string> {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();

    const lines = sorted.map((m) => {
      const time = m.createdAt.toISOString();
      const author = `${m.author.tag} (${m.author.id})`;
      const content = m.content || (m.embeds.length > 0 ? '[Embed]' : '[Aucun contenu]');
      return `[${time}] ${author}: ${content}`;
    });

    return `=== TRANSCRIPT TICKET ===\nSalon: #${channel.name}\nDate: ${new Date().toISOString()}\n\n${lines.join('\n')}`;
  } catch {
    return '';
  }
}

export { getTicketConfig };
