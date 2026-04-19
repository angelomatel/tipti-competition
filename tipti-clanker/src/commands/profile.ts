import {
  ApplicationCommandOptionType,
  type APIEmbedField,
  type CommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from 'discord.js';
import { Discord, Slash, SlashOption } from 'discordx';
import { getPlayer, getLeaderboard, getTournamentSettings } from '@/lib/backendClient';
import { formatOrdinal, formatTierDisplay } from '@/lib/format';
import { EMBED_COLORS, RANK_EMOJIS, GOD_COLORS, SOURCE_LABELS } from '@/lib/constants';
import { Tier } from '@/types/Rank';
import { logger } from '@/lib/logger';
import { dateToPhtDayStr, getCurrentPhtDay } from '@/lib/dateUtils';
import {
  getPublicErrorMessage,
  PUBLIC_ERROR_MESSAGES,
  sendCommandErrorAuditLog,
} from '@/lib/publicCommandErrors';

type LpStatus = 'known' | 'resolving' | 'unknown' | 'none';

type MatchEntry = {
  matchId: string;
  placement: number;
  playedAt: string | Date;
  lpStatus?: LpStatus;
};

type DailyPointTransaction = {
  value: number;
  source: string;
  matchId?: string | null;
  placement?: number;
  lpStatus?: LpStatus;
};

type DailyPointEntry = {
  day: string;
  transactions: DailyPointTransaction[];
};

type MatchLpInfo = {
  value?: number;
  lpStatus: LpStatus;
};

function buildTacticsToolsProfileUrl(gameName: string, tagLine: string): string {
  return `https://tactics.tools/player/sg/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
}

function buildMetatftProfileUrl(gameName: string, tagLine: string): string {
  return `https://www.metatft.com/player/SG2/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`;
}

function buildTacticsToolsMatchUrl(gameName: string, tagLine: string, matchId: string): string {
  return `${buildTacticsToolsProfileUrl(gameName, tagLine)}/${encodeURIComponent(matchId)}`;
}

function formatSignedValue(value: number, unit: string): string {
  return `${value >= 0 ? '+' : ''}${value} ${unit}`;
}

function formatLpInfo(info: MatchLpInfo | undefined): string | null {
  if (!info) return null;
  if (info.lpStatus === 'unknown') return 'LP unknown';
  if (info.lpStatus === 'resolving') return 'LP resolving';
  if (info.lpStatus === 'known' && typeof info.value === 'number') {
    return formatSignedValue(info.value, 'LP');
  }
  return null;
}

function getLpStatusPriority(status: LpStatus | undefined): number {
  switch (status) {
    case 'known': return 3;
    case 'resolving': return 2;
    case 'unknown': return 1;
    default: return 0;
  }
}

function buildMatchLpMap(dailyPoints: DailyPointEntry[] | undefined): Map<string, MatchLpInfo> {
  const matchLpMap = new Map<string, MatchLpInfo>();

  for (const day of dailyPoints ?? []) {
    for (const tx of day.transactions ?? []) {
      if (!tx.matchId) continue;
      if (tx.source !== 'lp_data' && tx.source !== 'lp_delta') continue;

      const nextStatus = tx.lpStatus ?? 'none';
      const existing = matchLpMap.get(tx.matchId);
      if (!existing || getLpStatusPriority(nextStatus) >= getLpStatusPriority(existing.lpStatus)) {
        matchLpMap.set(tx.matchId, {
          value: tx.value,
          lpStatus: nextStatus,
        });
      }
    }
  }

  return matchLpMap;
}

function truncateFieldValue(lines: string[], maxLength = 1024): string {
  if (lines.length === 0) return 'No data.';

  const accepted: string[] = [];
  for (const line of lines) {
    const candidate = accepted.length === 0 ? line : `${accepted.join('\n')}\n${line}`;
    if (candidate.length > maxLength) {
      if (accepted.length === 0) {
        return `${line.slice(0, Math.max(0, maxLength - 1))}...`;
      }
      return `${accepted.join('\n')}\n...`;
    }
    accepted.push(line);
  }

  return accepted.join('\n');
}

function formatTransactionLine(tx: DailyPointTransaction): string {
  const placementText = typeof tx.placement === 'number' ? ` (${formatOrdinal(tx.placement)})` : '';
  const label = (tx.source === 'lp_data' || tx.source === 'lp_delta')
    ? 'LP Delta'
    : (SOURCE_LABELS[tx.source] ?? tx.source);

  if (tx.lpStatus === 'unknown') return `${label}${placementText}: LP unknown`;
  if (tx.lpStatus === 'resolving') return `${label}${placementText}: LP resolving`;

  const unit = tx.source === 'lp_data' || tx.source === 'lp_delta' ? 'LP' : 'pts';
  return `${label}${placementText}: ${formatSignedValue(tx.value, unit)}`;
}

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
      const combinedLb = lbPodium.length > 0 ? [...lbPodium, ...lbEntries] : lbEntries;
      const leaderboardEntry = combinedLb.find((entry: any) => entry.discordId === targetId);

      const currentPhtDay = getCurrentPhtDay();
      const tierDisplay = formatTierDisplay(player.currentTier, player.currentRank, player.currentLP);
      const tierEmoji = RANK_EMOJIS[player.currentTier as Tier] ?? '';
      const scorePoints = profileData.scorePoints ?? 0;
      const gainsToday = typeof leaderboardEntry?.dailyPointGain === 'number'
        ? leaderboardEntry.dailyPointGain
        : ((profileData.dailyPoints ?? []).find((entry: DailyPointEntry) => entry.day === currentPhtDay)
          ?.transactions.reduce((sum: number, tx: DailyPointTransaction) => sum + tx.value, 0) ?? 0);
      const matches: MatchEntry[] = profileData.matches ?? [];
      const gamesToday = matches.filter((match) => dateToPhtDayStr(new Date(match.playedAt)) === currentPhtDay).length;
      const godName = profileData.godName ?? 'None';
      const godTitle = profileData.godTitle ? ` - ${profileData.godTitle}` : '';
      const tacticsToolsProfileUrl = buildTacticsToolsProfileUrl(player.gameName, player.tagLine);
      const metatftProfileUrl = buildMetatftProfileUrl(player.gameName, player.tagLine);
      const matchLpMap = buildMatchLpMap(profileData.dailyPoints as DailyPointEntry[] | undefined);

      const recentMatches = [...matches].slice(-5).reverse();
      const recentMatchLinks = recentMatches.length > 0
        ? recentMatches.map((match) => {
          const lpInfo = formatLpInfo(matchLpMap.get(match.matchId) ?? (match.lpStatus ? { lpStatus: match.lpStatus } : undefined));
          const linkLabel = lpInfo
            ? `${formatOrdinal(match.placement)} | ${lpInfo}`
            : formatOrdinal(match.placement);
          return `[${linkLabel}](${buildTacticsToolsMatchUrl(player.gameName, player.tagLine, match.matchId)})`;
        }).join(' | ')
        : 'No recent matches.';

      const fields: APIEmbedField[] = [
        {
          name: 'Rank | W/L | Games today',
          value: `${tierEmoji} ${tierDisplay} | ${player.currentWins}W / ${player.currentLosses}L | ${gamesToday}`,
          inline: false,
        },
        {
          name: 'Score Points | Gains Today',
          value: `${scorePoints} | ${formatSignedValue(gainsToday, 'pts')}`,
          inline: false,
        },
        {
          name: 'God | Links',
          value: `${godName}${godTitle} | [tactics.tools](${tacticsToolsProfileUrl}) | [metatft](${metatftProfileUrl})`,
          inline: false,
        },
        {
          name: 'Recent Matches',
          value: recentMatchLinks,
          inline: false,
        },
      ];

      const dailyPoints: DailyPointEntry[] = [...(profileData.dailyPoints ?? [])].reverse();
      if (dailyPoints.length === 0) {
        fields.push({
          name: 'Point Breakdown',
          value: 'No point transactions yet.',
          inline: false,
        });
      } else {
        const maxBreakdownDays = dailyPoints.length > 21 ? 20 : dailyPoints.length;
        for (const day of dailyPoints.slice(0, maxBreakdownDays)) {
          const total = day.transactions.reduce((sum, tx) => sum + tx.value, 0);
          const value = truncateFieldValue([
            `Total: ${formatSignedValue(total, 'pts')}`,
            ...day.transactions.map((tx) => formatTransactionLine(tx)),
          ]);

          fields.push({
            name: `Point Breakdown - ${day.day}`,
            value,
            inline: false,
          });
        }

        if (dailyPoints.length > maxBreakdownDays) {
          fields.push({
            name: 'Point Breakdown',
            value: `Showing latest ${maxBreakdownDays} days out of ${dailyPoints.length}.`,
            inline: false,
          });
        }
      }

      const eventStarted = new Date() >= new Date(settings.startDate);
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
        fallbackPrefix: 'Failed to fetch profile',
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
