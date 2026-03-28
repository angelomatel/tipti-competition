import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getTournamentSettings } from '@/services/tournamentService';
import { normalizeLP } from '@/lib/normalizeLP';
import { listActivePlayers } from '@/services/playerService';
import type { LeaderboardEntry, LeaderboardResponse } from '@/types/Leaderboard';

export async function computeLeaderboard(): Promise<LeaderboardResponse> {
  const settings = await getTournamentSettings();
  const players = await listActivePlayers();

  const entries = await Promise.all(
    players.map(async (player): Promise<LeaderboardEntry> => {
      const firstSnapshot = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: settings.startDate },
      }).sort({ capturedAt: 1 });

      const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);
      const baseNorm = firstSnapshot
        ? normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints)
        : currentNorm;

      return {
        rank: 0, // filled below after sort
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
        lpGain:           currentNorm - baseNorm,
        discordAvatarUrl: player.discordAvatarUrl ?? '',
        discordUsername:   player.discordUsername ?? '',
      };
    })
  );

  // Primary sort: current ranking hierarchy (tier → division → LP)
  // Secondary sort: LP gain since tournament start
  entries.sort((a, b) => {
    const aNorm = normalizeLP(a.currentTier, a.currentRank, a.currentLP);
    const bNorm = normalizeLP(b.currentTier, b.currentRank, b.currentLP);

    if (aNorm !== bNorm) {
      return bNorm - aNorm;
    }

    return b.lpGain - a.lpGain;
  });
  entries.forEach((e, i) => { e.rank = i + 1; });

  return { entries, updatedAt: new Date().toISOString() };
}
