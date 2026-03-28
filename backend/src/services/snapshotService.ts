import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getRiotClient } from '@/services/riotService';
import { logger } from '@/lib/logger';
import type { PlayerDocument } from '@/types/Player';

export async function captureSnapshotForPlayer(player: PlayerDocument): Promise<void> {
  const riot = getRiotClient();
  const entries = await riot.getTftLeagueByPuuid(player.puuid);
  const ranked = entries.find((e) => e.queueType === 'RANKED_TFT');
  if (!ranked) return;

  await LpSnapshot.create({
    puuid:         player.puuid,
    tier:          ranked.tier,
    rank:          ranked.rank,
    leaguePoints:  ranked.leaguePoints,
    wins:          ranked.wins,
    losses:        ranked.losses,
  });

  await Player.updateOne({ _id: player._id }, {
    currentTier:   ranked.tier,
    currentRank:   ranked.rank,
    currentLP:     ranked.leaguePoints,
    currentWins:   ranked.wins,
    currentLosses: ranked.losses,
  });
}

export async function captureAllSnapshots(): Promise<void> {
  const players = await Player.find({ isActive: true });
  for (const player of players) {
    try {
      await captureSnapshotForPlayer(player);
    } catch (err) {
      logger.error({ err, discordId: player.discordId }, `Snapshot failed for player ${player.discordId}`);
    }
  }
}
