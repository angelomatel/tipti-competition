import {
  ApplicationCommandOptionType,
  type CommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getPlayer, getLeaderboard, getTournamentSettings } from '@/lib/backendClient';
import { formatTierDisplay, formatLpGain } from '@/lib/format';
import { EMBED_COLORS, RANK_EMOJIS, GOD_COLORS } from '@/lib/constants';
import { Tier } from '@/types/Rank';
import { logger } from '@/lib/logger';
import {
  getPublicErrorMessage,
  PUBLIC_ERROR_MESSAGES,
  sendCommandErrorAuditLog,
} from '@/lib/publicCommandErrors';

@Discord()
export class Profile {
  @Slash({
    name: 'profile',
    description: 'View a player\'s tournament profile',
  })
  async profile(
    @SlashOption({
      name: 'user',
      description: 'The Discord user to view (defaults to yourself)',
      required: false,
      type: ApplicationCommandOptionType.User,
    })
    member: GuildMember | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    await interaction.deferReply();

    const targetId = member?.id ?? interaction.user.id;

    try {
      const [profileData, leaderboardData, { settings }] = await Promise.all([
        getPlayer(targetId),
        getLeaderboard(),
        getTournamentSettings(),
      ]);

      const player = profileData.player;
      if (!player) {
        const userMessage = PUBLIC_ERROR_MESSAGES.playerNotFound;
        await interaction.editReply({ content: userMessage });
        await sendCommandErrorAuditLog(interaction.client, {
          commandName: '/profile',
          actorId: interaction.user.id,
          target: targetId,
          userMessage,
        });
        return;
      }

      logger.info(
        {
          requesterId: interaction.user.id,
          targetDiscordId: targetId,
          riotId: player.riotId ?? `${player.gameName}#${player.tagLine}`,
        },
        '[profile] Fetched player profile',
      );

      const lbEntries: any[] = leaderboardData.entries ?? [];
      const lbPodium: any[] = leaderboardData.podiumEntries ?? [];
      const combinedLb = (lbPodium.length > 0) ? [...lbPodium, ...lbEntries] : lbEntries;
      const leaderboardEntry = combinedLb.find((e: any) => e.discordId === targetId);

      const eventStarted = new Date() >= new Date(settings.startDate);

      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);
      const tierEmoji = RANK_EMOJIS[player.currentTier as Tier] ?? '';
      const lpGain = leaderboardEntry ? formatLpGain(leaderboardEntry.lpGain) : 'N/A';
      const rankPos = leaderboardEntry ? `#${leaderboardEntry.rank}` : 'N/A';
      const scorePoints = profileData.scorePoints ?? 0;
      const godName = profileData.godName ?? 'None';
      const godTitle = profileData.godTitle ?? '';

      const fields = [
        { name: 'Rank', value: `${tierEmoji} ${tierDisplay}`, inline: true },
        { name: 'W/L', value: `${player.currentWins}W / ${player.currentLosses}L`, inline: true },
        { name: 'LP Gain (today)', value: lpGain, inline: true },
        { name: 'Leaderboard', value: rankPos, inline: true },
        { name: 'Score Points', value: `${scorePoints}`, inline: true },
      ];

      if (eventStarted) {
        fields.push({ name: 'God', value: godTitle ? `${godName} — ${godTitle}` : godName, inline: true });
      }

      // Add point breakdown if available
      const breakdown = profileData.pointBreakdown;
      if (breakdown) {
        const parts: string[] = [];
        if (breakdown.match) parts.push(`Match: ${breakdown.match}`);
        if (breakdown.buff) parts.push(`Buff: +${breakdown.buff}`);
        if (breakdown.penalty) parts.push(`Penalty: ${breakdown.penalty}`);
        if (breakdown.godPlacementBonus) parts.push(`God Bonus: +${breakdown.godPlacementBonus}`);
        if (parts.length > 0) {
          fields.push({ name: 'Point Breakdown', value: parts.join(' | '), inline: false });
        }
      }

      const embedColor = (eventStarted && profileData.godSlug)
        ? (GOD_COLORS[profileData.godSlug] ?? EMBED_COLORS.PRIMARY)
        : EMBED_COLORS.PRIMARY;

      const embed = new EmbedBuilder()
        .setTitle(`${player.gameName}#${player.tagLine}`)
        .addFields(fields)
        .setColor(embedColor)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      const userMessage = getPublicErrorMessage(err, {
        notFoundMessage: PUBLIC_ERROR_MESSAGES.playerNotFound,
        fallbackPrefix: '❌ Failed to fetch profile',
      });
      await interaction.editReply({ content: userMessage });
      await sendCommandErrorAuditLog(interaction.client, {
        commandName: '/profile',
        actorId: interaction.user.id,
        target: targetId,
        userMessage,
        error: err,
      });
    }
  }
}
