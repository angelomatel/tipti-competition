import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getRiotClient } from '@/services/riotService';
import { findRankedEntry } from '@/lib/riotUtils';
import type { PlayerDocument } from '@/types/Player';
import type { RegisterPlayerRequest } from '@/types/User';

export async function registerPlayer(data: RegisterPlayerRequest): Promise<PlayerDocument> {
  const { discordId, gameName, tagLine, addedBy, discordAvatarUrl, discordUsername } = data;

  const existing = await Player.findOne({ discordId });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
      return existing;
    }
    throw new Error(`Player with discordId ${discordId} is already registered.`);
  }

  const riot = getRiotClient();
  const puuid = await riot.getPuuidByRiotId(gameName, tagLine);
  const leagueEntries = await riot.getTftLeagueByPuuid(puuid);
  const ranked = findRankedEntry(leagueEntries);

  const player = await Player.create({
    discordId,
    puuid,
    gameName,
    tagLine,
    riotId: `${gameName}#${tagLine}`,
    addedBy,
    isActive: true,
    currentTier:   ranked?.tier        ?? 'UNRANKED',
    currentRank:   ranked?.rank        ?? '',
    currentLP:     ranked?.leaguePoints ?? 0,
    currentWins:      ranked?.wins        ?? 0,
    currentLosses:    ranked?.losses      ?? 0,
    discordAvatarUrl: discordAvatarUrl ?? '',
    discordUsername:   discordUsername ?? '',
  });

  // Save initial snapshot as the tournament baseline
  if (ranked) {
    await LpSnapshot.create({
      puuid,
      tier:          ranked.tier,
      rank:          ranked.rank,
      leaguePoints:  ranked.leaguePoints,
      wins:          ranked.wins,
      losses:        ranked.losses,
    });
  }

  return player;
}

export async function removePlayer(discordId: string): Promise<void> {
  const result = await Player.updateOne({ discordId }, { isActive: false });
  if (result.matchedCount === 0) {
    throw new Error(`Player with discordId ${discordId} not found.`);
  }
}

export async function listActivePlayers(): Promise<PlayerDocument[]> {
  return Player.find({ isActive: true });
}

export async function getPlayerByDiscordId(discordId: string): Promise<PlayerDocument | null> {
  return Player.findOne({ discordId });
}
