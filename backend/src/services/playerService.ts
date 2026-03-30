import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getRiotClient } from '@/services/riotService';
import { findRankedEntry } from '@/lib/riotUtils';
import type { PlayerDocument } from '@/types/Player';
import type { RegisterPlayerRequest } from '@/types/User';

function isMongoDuplicateKeyError(err: unknown): err is { code: number; message?: string } {
  if (!err || typeof err !== 'object') return false;
  const maybeErr = err as { code?: number; message?: string };
  return maybeErr.code === 11000 || maybeErr.message?.includes('E11000') === true;
}

export async function registerPlayer(data: RegisterPlayerRequest): Promise<PlayerDocument> {
  const { discordId, gameName, tagLine, addedBy, discordAvatarUrl, discordUsername, godSlug } = data;

  const existing = await Player.findOne({ discordId });
  if (existing) {
    if (!existing.isActive) {
      // Re-fetch current rank from Riot and create a fresh baseline
      const riot = getRiotClient();
      const leagueEntries = await riot.getTftLeagueByPuuid(existing.puuid);
      const ranked = findRankedEntry(leagueEntries);

      existing.isActive = true;
      existing.godSlug = godSlug;
      existing.isEliminatedFromGod = false;
      existing.currentTier   = ranked?.tier        ?? 'UNRANKED';
      existing.currentRank   = ranked?.rank        ?? '';
      existing.currentLP     = ranked?.leaguePoints ?? 0;
      existing.currentWins   = ranked?.wins        ?? 0;
      existing.currentLosses = ranked?.losses      ?? 0;
      await existing.save();

      if (ranked) {
        await LpSnapshot.create({
          puuid:         existing.puuid,
          tier:          ranked.tier,
          rank:          ranked.rank,
          leaguePoints:  ranked.leaguePoints,
          wins:          ranked.wins,
          losses:        ranked.losses,
        });
      }

      return existing;
    }
    throw new Error(`Player with discordId ${discordId} is already registered.`);
  }

  const riot = getRiotClient();
  const puuid = await riot.getPuuidByRiotId(gameName, tagLine);

  const existingByPuuid = await Player.findOne({ puuid });
  if (existingByPuuid) {
    throw new Error(`Player with Riot account ${gameName}#${tagLine} is already registered.`);
  }

  const leagueEntries = await riot.getTftLeagueByPuuid(puuid);
  const ranked = findRankedEntry(leagueEntries);

  let player: PlayerDocument;
  try {
    player = await Player.create({
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
      godSlug,
    });
  } catch (err) {
    if (isMongoDuplicateKeyError(err)) {
      throw new Error(`Player with Riot account ${gameName}#${tagLine} is already registered.`);
    }
    throw err;
  }

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

export async function updatePlayerProfile(
  discordId: string,
  updates: Partial<Pick<PlayerDocument, 'discordAvatarUrl' | 'discordUsername'>>,
): Promise<void> {
  await Player.updateOne({ discordId }, { $set: updates });
}
