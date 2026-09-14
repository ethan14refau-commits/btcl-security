import {
  Events,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  InteractionType,
  PermissionResolvable,
  PermissionFlagsBits,
  ButtonInteraction,
  TextChannel,
} from 'discord.js';
import { BotEvent } from '../types/event.js';
import { BotClient } from '../types/discord.js';
import { logger } from '../utils/logger.js';
import { errorEmbed, successEmbed } from '../utils/embeds.js';
import { requireBotOwner } from '../middleware/requireBotOwner.js';
import { memberHasPermissions, botHasPermissions } from '../utils/permissions.js';
import { prisma } from '../database/client.js';
import { endGiveaway, updateParticipantCount } from '../services/giveaway/GiveawayService.js';
import { createTicket, closeTicket, claimTicket } from '../services/ticket/TicketService.js';

const event: BotEvent<Events.InteractionCreate> = {
  name: Events.InteractionCreate,

  async execute(client: BotClient, interaction): Promise<void> {
    // Handle autocomplete
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
      const autocomplete = interaction as AutocompleteInteraction;
      const command = client.commands.get(autocomplete.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(autocomplete, client);
      } catch (err) {
        logger.error(`Autocomplete error for ${autocomplete.commandName}:`, err);
      }
      return;
    }

    // Only handle slash commands
    if (!interaction.isChatInputCommand()) {
      // ─── Button interactions ──────────────────────────────────────────────
      if (interaction.isButton()) {
        const btn = interaction as ButtonInteraction;

        // ── Giveaway enter button ──
        if (btn.customId === 'giveaway_enter') {
          await btn.deferReply({ ephemeral: true });

          const giveaway = await prisma.giveaway.findFirst({
            where: { messageId: btn.message.id, ended: false, cancelled: false },
          });

          if (!giveaway) {
            await btn.editReply({ content: '❌ Ce giveaway est terminé.' });
            return;
          }

          // Check if already entered
          const existing = await prisma.giveawayEntry.findUnique({
            where: { messageId_userId: { messageId: btn.message.id, userId: btn.user.id } },
          });

          if (existing) {
            await btn.editReply({ content: '❌ Tu participes déjà à ce giveaway !' });
            return;
          }

          // Add entry
          await prisma.giveawayEntry.create({
            data: { messageId: btn.message.id, userId: btn.user.id },
          });

          await btn.editReply({ content: '🎉 Tu participes au giveaway ! Bonne chance !' });

          // Update participant count in embed
          await updateParticipantCount(client, btn.message.id, btn.channelId);
          return;
        }

        // ── Ticket create button ──
        if (btn.customId === 'ticket_create') {
          await btn.deferReply({ ephemeral: true });
          if (!btn.guild || !btn.member) return;
          const member = await btn.guild.members.fetch(btn.user.id);
          try {
            const ticketChannel = await createTicket(client, btn.guild, member);
            await btn.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel.toString()}` });
          } catch (e) {
            await btn.editReply({ content: `❌ ${String(e)}` });
          }
          return;
        }

        // ── Ticket close button ──
        if (btn.customId === 'ticket_close') {
          await btn.deferReply({ ephemeral: true });
          if (!btn.guild || !btn.member) return;
          const member = await btn.guild.members.fetch(btn.user.id);
          const ticket = await prisma.ticket.findUnique({ where: { channelId: btn.channelId } });
          if (!ticket) { await btn.editReply({ content: '❌ Ce salon n\'est pas un ticket.' }); return; }

          // Check permission: ticket creator or support role
          const config = await prisma.ticketConfig.findUnique({ where: { guildId: btn.guildId! } });
          const isSupportStaff = config?.supportRoleId ? member.roles.cache.has(config.supportRoleId) : false;
          const isCreator = ticket.userId === btn.user.id;
          const isAdmin = member.permissions.has(PermissionFlagsBits.ManageChannels);

          if (!isCreator && !isSupportStaff && !isAdmin) {
            await btn.editReply({ content: '❌ Seul le créateur ou le staff peut fermer ce ticket.' });
            return;
          }

          await btn.editReply({ content: '🔒 Fermeture du ticket...' });
          await closeTicket(client, btn.channel as TextChannel, member);
          return;
        }

        // ── Ticket claim button ──
        if (btn.customId === 'ticket_claim') {
          await btn.deferReply({ ephemeral: true });
          if (!btn.guild) return;
          const member = await btn.guild.members.fetch(btn.user.id);
          try {
            await claimTicket(btn.channel as TextChannel, member);
            await btn.editReply({ content: `✅ Tu as pris ce ticket en charge.` });
            await (btn.channel as TextChannel).send({
              embeds: [successEmbed('Ticket pris en charge', `${member.toString()} prend en charge ce ticket.`)],
            });
          } catch (e) {
            await btn.editReply({ content: `❌ ${String(e)}` });
          }
          return;
        }

        // ── Ticket transcript button ──
        if (btn.customId === 'ticket_transcript') {
          await btn.deferReply({ ephemeral: true });
          await btn.editReply({ content: '📄 Le transcript sera généré lors de la fermeture du ticket.' });
          return;
        }
      }
      return;
    }
    const cmd = interaction as ChatInputCommandInteraction;

    const command = client.commands.get(cmd.commandName);
    if (!command) return;

    // Guild-only enforcement
    if (!cmd.guild || !cmd.member) {
      await cmd.reply({
        embeds: [errorEmbed('Guild Only', 'This command can only be used in a server.')],
        ephemeral: true,
      });
      return;
    }

    // Bot Owner check
    if (command.ownerOnly) {
      const allowed = await requireBotOwner(cmd);
      if (!allowed) return; // requireBotOwner already replied
    }

    // User permission check
    if (command.userPermissions?.length) {
      const member = await cmd.guild.members.fetch(cmd.user.id);
      if (!memberHasPermissions(member, command.userPermissions as PermissionResolvable[])) {
        await cmd.reply({
          embeds: [errorEmbed(
            'Missing Permissions',
            `You need the following permissions: ${command.userPermissions.join(', ')}`
          )],
          ephemeral: true,
        });
        return;
      }
    }

    // Bot permission check
    if (command.botPermissions?.length) {
      const botMember = await cmd.guild.members.fetchMe();
      if (!botHasPermissions(botMember, command.botPermissions as PermissionResolvable[])) {
        await cmd.reply({
          embeds: [errorEmbed(
            'Bot Missing Permissions',
            `I need the following permissions: ${command.botPermissions.join(', ')}`
          )],
          ephemeral: true,
        });
        return;
      }
    }

    // Execute command
    try {
      await command.execute(cmd, client);
    } catch (err) {
      logger.error(`Command error [${cmd.commandName}]:`, err);
      const embed = errorEmbed(
        'Command Error',
        'An unexpected error occurred. This has been logged.'
      );
      if (cmd.replied || cmd.deferred) {
        await cmd.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await cmd.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};

export default event;
