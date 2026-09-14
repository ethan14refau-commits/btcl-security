import {
  GuildMember,
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
  ButtonInteraction,
} from 'discord.js';
import { prisma } from '../../database/client.js';
import { BotClient } from '../../types/discord.js';
import { logger } from '../../utils/logger.js';

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getVerificationConfig(guildId: string) {
  let config = await prisma.verificationConfig.findUnique({ where: { guildId } });
  if (!config) {
    config = await prisma.verificationConfig.create({ data: { guildId } });
  }
  return config;
}

// ─── Alphanumeric code generator (5 chars) ───────────────────────────────────

function generateVerificationCode(): { question: string; answer: string } {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return {
    question: `Recopie ce code exactement : \`${code}\``,
    answer: code,
  };
}

// ─── Send verification message on join ───────────────────────────────────────

export async function sendVerificationMessage(
  client: BotClient,
  member: GuildMember
): Promise<void> {
  const config = await getVerificationConfig(member.guild.id);
  if (!config.enabled || !config.verificationChannelId) return;

  const channel = await client.channels.fetch(config.verificationChannelId).catch(() => null) as TextChannel | null;
  if (!channel?.isTextBased()) {
    logger.warn(`[Verification] Channel ${config.verificationChannelId} not found`);
    return;
  }

  const { question, answer } = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save pending record with question + answer
  await prisma.verificationPending.upsert({
    where: { guildId_userId: { guildId: member.guild.id, userId: member.id } },
    create: { guildId: member.guild.id, userId: member.id, question, answer, expiresAt },
    update: { question, answer, expiresAt },
  });

  // Apply pending role if configured
  if (config.pendingRoleId) {
    const pendingRole = member.guild.roles.cache.get(config.pendingRoleId);
    if (pendingRole) await member.roles.add(pendingRole, 'Awaiting verification').catch(() => {});
  }

  // Send verification embed with button
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔐 Vérification requise')
    .setDescription(
      [
        `Bienvenue ${member.toString()} sur **${member.guild.name}** !`,
        '',
        'Pour accéder au serveur, clique sur le bouton ci-dessous.',
        'Tu devras recopier un code de **5 caractères** affiché dans le formulaire.',
        '',
        '⏰ Tu as **10 minutes** pour te vérifier, sinon tu seras expulsé.',
      ].join('\n')
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Membre ID: ${member.id}` })
    .setTimestamp();

  const button = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`verify_start_${member.id}`)
      .setLabel('✅ Je me vérifie')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({ embeds: [embed], components: [button] });
  logger.info(`[Verification] Message sent for ${member.user.tag} in ${member.guild.name}`);
}

// ─── Handle button click → show modal ────────────────────────────────────────

export async function handleVerifyButton(
  interaction: ButtonInteraction,
  targetUserId: string
): Promise<void> {
  // Only the correct user can click their button
  if (interaction.user.id !== targetUserId) {
    await interaction.reply({ content: '❌ Ce bouton n\'est pas pour toi.', ephemeral: true });
    return;
  }

  const pending = await prisma.verificationPending.findUnique({
    where: { guildId_userId: { guildId: interaction.guildId!, userId: interaction.user.id } },
  });

  if (!pending) {
    await interaction.reply({ content: '✅ Tu es déjà vérifié !', ephemeral: true });
    return;
  }

  if (pending.expiresAt < new Date()) {
    await interaction.reply({
      content: '❌ Ta vérification a expiré. Quitte et rejoins de nouveau le serveur.',
      ephemeral: true,
    });
    return;
  }

  // Show modal with the code to recoppy
  const modal = new ModalBuilder()
    .setCustomId(`verify_modal_${interaction.user.id}`)
    .setTitle('🔐 Vérification anti-bot');

  const answerInput = new TextInputBuilder()
    .setCustomId('verify_answer')
    .setLabel(`Code à recopier : ${pending.answer}`)
    .setPlaceholder('Recopie le code ci-dessus (5 caractères)...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(5)
    .setMaxLength(5);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(answerInput)
  );

  await interaction.showModal(modal);
}

// ─── Handle modal submission → assign role ────────────────────────────────────

export async function handleVerifyModal(
  interaction: ModalSubmitInteraction,
  targetUserId: string
): Promise<void> {
  if (interaction.user.id !== targetUserId) {
    await interaction.reply({ content: '❌ Ce modal n\'est pas pour toi.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const pending = await prisma.verificationPending.findUnique({
    where: { guildId_userId: { guildId: interaction.guildId!, userId: interaction.user.id } },
  });

  if (!pending) {
    await interaction.editReply({ content: '✅ Tu es déjà vérifié !' });
    return;
  }

  if (pending.expiresAt < new Date()) {
    await interaction.editReply({ content: '❌ Ta vérification a expiré. Rejoins de nouveau le serveur.' });
    return;
  }

  const userAnswer = interaction.fields.getTextInputValue('verify_answer').trim().toUpperCase();

  if (userAnswer !== pending.answer.toUpperCase()) {
    await interaction.editReply({
      content: `❌ Code incorrect (**${userAnswer}**). Clique de nouveau sur le bouton pour réessayer.`,
    });
    return;
  }

  // ✅ Correct answer — assign verified role
  const config = await getVerificationConfig(interaction.guildId!);
  const member = await interaction.guild!.members.fetch(interaction.user.id).catch(() => null);

  if (!member) {
    await interaction.editReply({ content: '❌ Impossible de trouver ton profil. Contacte un administrateur.' });
    return;
  }

  // Add verified role
  if (config.verifiedRoleId) {
    const role = interaction.guild!.roles.cache.get(config.verifiedRoleId);
    if (role) {
      await member.roles.add(role, 'Verification passed').catch((err) => {
        logger.error(`[Verification] Failed to add role: ${err.message}`);
      });
    } else {
      logger.warn(`[Verification] Verified role ${config.verifiedRoleId} not found in guild`);
    }
  }

  // Remove pending role
  if (config.pendingRoleId) {
    const pendingRole = interaction.guild!.roles.cache.get(config.pendingRoleId);
    if (pendingRole) await member.roles.remove(pendingRole, 'Verification passed').catch(() => {});
  }

  // Delete the pending record
  await prisma.verificationPending.delete({
    where: { guildId_userId: { guildId: interaction.guildId!, userId: interaction.user.id } },
  });

  logger.info(`[Verification] ✅ ${interaction.user.tag} verified in ${interaction.guild!.name}`);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Vérification réussie !')
        .setDescription(`Bienvenue ${interaction.user.toString()} ! Tu as maintenant accès au serveur. 🎉`)
        .setTimestamp(),
    ],
  });

  // Delete the verification message
  try {
    if (config.verificationChannelId) {
      const channel = await interaction.client.channels.fetch(config.verificationChannelId) as TextChannel;
      const messages = await channel.messages.fetch({ limit: 20 });
      const verifyMsg = messages.find(
        (m) => m.components.length > 0 &&
          m.components[0].components[0]?.customId === `verify_start_${interaction.user.id}`
      );
      if (verifyMsg) await verifyMsg.delete().catch(() => {});
    }
  } catch { /* ignore — message may already be deleted */ }
}

// ─── Cleanup expired pending verifications (run every 2 min) ─────────────────

export async function cleanupExpiredVerifications(client: BotClient): Promise<void> {
  const expired = await prisma.verificationPending.findMany({
    where: { expiresAt: { lt: new Date() } },
  });

  for (const pending of expired) {
    try {
      const guild = client.guilds.cache.get(pending.guildId);
      if (!guild) continue;

      const member = await guild.members.fetch(pending.userId).catch(() => null);
      if (member) {
        await member.kick('Vérification expirée — délai dépassé').catch(() => {});
        logger.info(`[Verification] Kicked ${pending.userId} — verification expired`);
      }

      await prisma.verificationPending.delete({
        where: { guildId_userId: { guildId: pending.guildId, userId: pending.userId } },
      });
    } catch (err) {
      logger.warn(`[Verification] Cleanup error for ${pending.userId}: ${String(err)}`);
    }
  }
}
