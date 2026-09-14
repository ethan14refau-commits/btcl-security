import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '../../types/command.js';
import { BotClient } from '../../types/discord.js';
import {
  getInviteStats,
  getInviteLeaderboard,
} from '../../services/inviteTracker/InviteTrackerService.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('invites')
    .setDescription('Voir les statistiques d\'invitations')
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Voir les invitations d\'un membre')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Membre à vérifier (toi par défaut)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('top').setDescription('Voir le classement des meilleurs inviters')
    ),

  botPermissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction, _client: BotClient): Promise<void> {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === 'check') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const stats = await getInviteStats(guildId, target.id);

      const embed = new EmbedBuilder()
        .setTitle(`📨 Invitations — ${target.username}`)
        .setThumbnail(target.displayAvatarURL())
        .setColor(0x5865f2)
        .addFields(
          { name: 'Total d\'invitations', value: `**${stats.total}** membre(s) invité(s)`, inline: false }
        )
        .setTimestamp();

      if (stats.joins.length > 0) {
        const recent = stats.joins
          .slice(0, 5)
          .map((j) => `• <@${j.joinerId}> — <t:${Math.floor(j.joinedAt.getTime() / 1000)}:R>`)
          .join('\n');
        embed.addFields({ name: 'Derniers membres invités', value: recent, inline: false });
      }

      await interaction.reply({ embeds: [embed], ephemeral: false });
    }

    if (sub === 'top') {
      const leaderboard = await getInviteLeaderboard(guildId);

      if (leaderboard.length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('📨 Top Inviters')
              .setDescription('Aucune donnée d\'invitation pour ce serveur.')
              .setColor(0x99aab5)
              .setTimestamp(),
          ],
        });
        return;
      }

      const medals = ['🥇', '🥈', '🥉'];
      const list = leaderboard
        .map((entry, i) => `${medals[i] ?? `**${i + 1}.**`} <@${entry.inviterId}> — **${entry.count}** invitation(s)`)
        .join('\n');

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📨 Top Inviters')
            .setDescription(list)
            .setColor(0xf1c40f)
            .setFooter({ text: `Top ${leaderboard.length} inviters` })
            .setTimestamp(),
        ],
      });
    }
  },
};

export default command;
