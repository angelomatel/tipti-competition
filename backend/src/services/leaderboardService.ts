import { LpSnapshot } from '@/db/models/LpSnapshot';
import { God } from '@/db/models/God';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerDailyPointGainTotals, computePlayerScoreTotals } from '@/services/scoringEngine';
import { normalizeLP } from '@/lib/normalizeLP';
import { getDayBoundsUTC8, getTodayUTC8 } from '@/lib/dateUtils';
import { listActivePlayers } from '@/services/playerService';
import { LEADERBOARD_CACHE_TTL_MS } from '@/constants';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types/Leaderboard';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;

interface ComputeLeaderboardOptions {
  page?: number;
  pageSize?: number;
}

interface SnapshotBaseline {
  puuid: string;
  tier: string;
  rank: string;
  leaguePoints: number;
}

interface CacheEntry {
  expiresAt: number;
  value: LeaderboardResponse;
}

const leaderboardCache = new Map<string, CacheEntry>();

export function clearLeaderboardCache(): void {
  leaderboardCache.clear();
}

function getCachedLeaderboard(key: string): LeaderboardResponse | null {
  const cached = leaderboardCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    leaderboardCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedLeaderboard(key: string, value: LeaderboardResponse): void {
  if (LEADERBOARD_CACHE_TTL_MS <= 0) return;
  leaderboardCache.set(key, {
    expiresAt: Date.now() + LEADERBOARD_CACHE_TTL_MS,
    value,
  });
}

async function getFirstSnapshotsByPuuid(
  puuids: string[],
  capturedAt: Record<string, Date | Record<string, Date>>,
): Promise<Map<string, SnapshotBaseline>> {
  if (puuids.length === 0) return new Map();

  const rows = await LpSnapshot.aggregate<SnapshotBaseline & { _id: string }>([
    { $match: { puuid: { $in: puuids }, capturedAt } },
    { $sort: { puuid: 1, capturedAt: 1 } },
    {
      $group: {
        _id: '$puuid',
        puuid: { $first: '$puuid' },
        tier: { $first: '$tier' },
        rank: { $first: '$rank' },
        leaguePoints: { $first: '$leaguePoints' },
      },
    },
  ]);

  return new Map(rows.map((row) => [row.puuid, row]));
}

export async function computeLeaderboard(options: ComputeLeaderboardOptions = {}): Promise<LeaderboardResponse> {
  const requestedPage = options.page ?? DEFAULT_PAGE;
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const cacheKey = `${requestedPage}:${pageSize}`;
  const cached = getCachedLeaderboard(cacheKey);
  if (cached) return cached;

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();
  const today = getTodayUTC8();
  const { dayStart, dayEnd } = getDayBoundsUTC8(today);
  const playerIds = players.map((player) => player.discordId);
  const puuids = players.map((player) => player.puuid);

  const hideGods = new Date() < settings.startDate;

  const [
    gods,
    scoreTotals,
    dailyPointGainTotals,
    tournamentBaselines,
    dailyBaselines,
  ] = await Promise.all([
    God.find().lean(),
    computePlayerScoreTotals(playerIds),
    computePlayerDailyPointGainTotals(playerIds, today),
    getFirstSnapshotsByPuuid(puuids, { $gte: settings.startDate }),
    getFirstSnapshotsByPuuid(puuids, { $gte: dayStart, $lte: dayEnd }),
  ]);

  const godMap = new Map(gods.map((g) => [g.slug, g]));

  const entries = players.map((player): LeaderboardEntry & { _tournamentLpGain: number } => {
      const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);

      const tournamentBaseline = tournamentBaselines.get(player.puuid);
      const tournamentBaseNorm = tournamentBaseline
        ? normalizeLP(tournamentBaseline.tier, tournamentBaseline.rank, tournamentBaseline.leaguePoints)
        : currentNorm;

      const dailyBaseline = dailyBaselines.get(player.puuid);
      const dailyLpGain = dailyBaseline
        ? currentNorm - normalizeLP(dailyBaseline.tier, dailyBaseline.rank, dailyBaseline.leaguePoints)
        : 0;

      const scorePoints = scoreTotals.get(player.discordId) ?? 0;
      const dailyPointGain = dailyPointGainTotals.get(player.discordId) ?? 0;

      const god = player.godSlug ? godMap.get(player.godSlug) : null;

      return {
        rank: 0,
        discordId:     player.discordId,
        puuid:         player.puuid,
        gameName:      player.gameName,
        tagLine:       player.tagLine,
        riotId:        player.riotId,
        currentTier:   player.currentTier,
        currentRank:   player.currentRank,
        currentLP:     player.currentLP,
        currentWins:   player.currentWins,
        currentLosses:    player.currentLosses,
        lpGain:           dailyLpGain,
        scorePoints,
        godSlug:          hideGods ? null : player.godSlug,
        godName:          hideGods ? 'Hidden' : (god?.name ?? null),
        isEliminatedFromGod: player.isEliminatedFromGod,
        dailyPointGain,
        discordAvatarUrl: player.discordAvatarUrl ?? '',
        discordUsername:   player.discordUsername ?? '',
        _tournamentLpGain: currentNorm - tournamentBaseNorm,
      };
    });

  // Primary sort: scorePoints descending
  // Secondary sort: normalized LP (tiebreaker)
  // Tertiary sort: tournament LP gain (tiebreaker)
  entries.sort((a, b) => {
    if (a.scorePoints !== b.scorePoints) return b.scorePoints - a.scorePoints;

    const aNorm = normalizeLP(a.currentTier, a.currentRank, a.currentLP);
    const bNorm = normalizeLP(b.currentTier, b.currentRank, b.currentLP);
    if (aNorm !== bNorm) return bNorm - aNorm;

    return b._tournamentLpGain - a._tournamentLpGain;
  });
  entries.forEach((e, i) => { e.rank = i + 1; });

  // Strip internal field before returning
  const cleaned: LeaderboardEntry[] = entries.map(({ _tournamentLpGain, ...entry }) => entry);

  const totalEntries = cleaned.length;
  const hasStarted = new Date() >= settings.startDate;
  const podiumEligible = hasStarted && totalEntries >= 3 && pageSize >= 3;

  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const startIdx = (page - 1) * pageSize;
  const pageContent = cleaned.slice(startIdx, startIdx + pageSize);

  const podiumEntries = (page === 1 && podiumEligible) ? pageContent.slice(0, 3) : [];
  const paginatedEntries = (page === 1 && podiumEligible) ? pageContent.slice(3) : pageContent;

  const response = {
    page,
    pageSize,
    totalEntries,
    totalPages,
    podiumEntries,
    entries: paginatedEntries,
    updatedAt: new Date().toISOString(),
  };

  setCachedLeaderboard(cacheKey, response);
  return response;
}
