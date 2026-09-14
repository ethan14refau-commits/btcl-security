import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import {
  addAutoRole,
  removeAutoRole,
  getAutoRoles,
} from '../../services/autoRole/AutoRoleService.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Gérer les rôles automatiques attribués aux nouveaux membres')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajouter un rôle automatique')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle à attribuer automatiquement').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Supprimer un rôle automatique')
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Rôle à retirer de l\'auto-role').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Voir tous les rôles automatiques configurés')
    ),

  userPermissions: [PermissionFlagsBits.ManageGuild],
  botPermissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'add') {
      const role = interaction.options.getRole('role', true);

      // Vérifier que le bot peut attribuer ce rôle (hiérarchie)
      const botMember = await interaction.guild!.members.fetchMe();
      if (role.position >= botMember.roles.highest.position) {
        await interaction.reply({
          embeds: [errorEmbed('Hiérarchie insuffisante', `Je ne peux pas attribuer le rôle ${role.toString()} car il est au-dessus de mon rôle le plus élevé.`)],
          ephemeral: true,
        });
        return;
      }

      await addAutoRole(guildId, role.id);

      await interaction.reply({
        embeds: [successEmbed('Auto-Role Ajouté', `${role.toString()} sera automatiquement attribué à chaque nouveau membre qui rejoint le serveur.`)],
        ephemeral: true,
      });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role', true);
      const removed = await removeAutoRole(guildId, role.id);

      if (!removed) {
        await interaction.reply({
          embeds: [errorEmbed('Introuvable', `${role.toString()} n'est pas configuré comme auto-role.`)],
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        embeds: [successEmbed('Auto-Role Retiré', `${role.toString()} ne sera plus attribué automatiquement.`)],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const roles = await getAutoRoles(guildId);

      if (roles.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('🎭 Auto-Roles')
              .setDescription('Aucun auto-role configuré.\nUtilise `/autorole add` pour en ajouter un.')
              .setColor(0x99aab5)
              .setTimestamp(),
          ],
          ephemeral: true,
        });
        return;
      }

      const list = roles
        .map((r) => `• <@&${r.roleId}>`)
        .join('\n');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎭 Auto-Roles')
            .setDescription(list)
            .setColor(0x5865f2)
            .setFooter({ text: `${roles.length} rôle(s) configuré(s)` })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
    }
  },
};

export default command;
