import { LpSnapshot } from '@/db/models/LpSnapshot';
import { God } from '@/db/models/God';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerScore, computePlayerDailyPointGain } from '@/services/scoringEngine';
import { normalizeLP } from '@/lib/normalizeLP';
import { getDayBoundsUTC8, getTodayUTC8 } from '@/lib/dateUtils';
import { listActivePlayers } from '@/services/playerService';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types/Leaderboard';

export async function computeLeaderboard(): Promise<LeaderboardResponse> {
  const settings = await getTournamentSettings();
  const players = await listActivePlayers();
  const today = getTodayUTC8();
  const { dayStart, dayEnd } = getDayBoundsUTC8(today);

  // Cache god lookup
  const gods = await God.find().lean();
  const godMap = new Map(gods.map((g) => [g.slug, g]));

  const entries = await Promise.all(
    players.map(async (player): Promise<LeaderboardEntry & { _tournamentLpGain: number }> => {
      const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);

      // Tournament baseline: first snapshot on/after tournament start
      const tournamentBaseline = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: settings.startDate },
      }).sort({ capturedAt: 1 });
      const tournamentBaseNorm = tournamentBaseline
        ? normalizeLP(tournamentBaseline.tier, tournamentBaseline.rank, tournamentBaseline.leaguePoints)
        : currentNorm;

      // Daily baseline: first snapshot of today (UTC+8)
      const dailyBaseline = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ capturedAt: 1 });
      const dailyLpGain = dailyBaseline
        ? currentNorm - normalizeLP(dailyBaseline.tier, dailyBaseline.rank, dailyBaseline.leaguePoints)
        : 0;

      const scorePoints = await computePlayerScore(player.discordId);
      const dailyPointGain = await computePlayerDailyPointGain(player.discordId, today);

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
        godSlug:          player.godSlug,
        godName:          god?.name ?? null,
        isEliminatedFromGod: player.isEliminatedFromGod,
        dailyPointGain,
        discordAvatarUrl: player.discordAvatarUrl ?? '',
        discordUsername:   player.discordUsername ?? '',
        _tournamentLpGain: currentNorm - tournamentBaseNorm,
      };
    })
  );

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

  return { entries: cleaned, updatedAt: new Date().toISOString() };
}
