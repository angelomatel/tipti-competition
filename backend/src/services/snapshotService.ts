import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getRiotClient } from '@/services/riotService';
import { findRankedEntry } from '@/lib/riotUtils';
import { logger } from '@/lib/logger';
import { withRetry } from '@/lib/withRetry';
import { listActivePlayers } from '@/services/playerService';
import type { PlayerDocument } from '@/types/Player';

export async function captureSnapshotForPlayer(player: PlayerDocument): Promise<PlayerDocument> {
  const riot = getRiotClient();
  const entries = await riot.getTftLeagueByPuuid(player.puuid);
  const ranked = findRankedEntry(entries);
  if (!ranked) return player;

  // Only create a new snapshot if rank data has changed since the last one
  const lastSnapshot = await LpSnapshot.findOne({ puuid: player.puuid }).sort({ capturedAt: -1 });
  const unchanged = lastSnapshot
    && lastSnapshot.tier          === ranked.tier
    && lastSnapshot.rank          === ranked.rank
    && lastSnapshot.leaguePoints  === ranked.leaguePoints
    && lastSnapshot.wins          === ranked.wins
    && lastSnapshot.losses        === ranked.losses;

  if (!unchanged) {
    await withRetry('LpSnapshot.create', () => LpSnapshot.create({
      puuid:         player.puuid,
      tier:          ranked.tier,
      rank:          ranked.rank,
      leaguePoints:  ranked.leaguePoints,
      wins:          ranked.wins,
      losses:        ranked.losses,
    }));
  }

  const updatedPlayer = await withRetry('Player.findOneAndUpdate', () => Player.findOneAndUpdate(
    { _id: player._id },
    {
      currentTier:   ranked.tier,
      currentRank:   ranked.rank,
      currentLP:     ranked.leaguePoints,
      currentWins:   ranked.wins,
      currentLosses: ranked.losses,
    },
    { new: true },
  ));

  return (updatedPlayer ?? player) as PlayerDocument;
}

export async function captureAllSnapshots(): Promise<void> {
  const players = await listActivePlayers();
  for (const player of players) {
    try {
      await captureSnapshotForPlayer(player);
    } catch (err) {
      logger.error({ err, discordId: player.discordId }, `Snapshot failed for player ${player.discordId}`);
    }
  }
}
