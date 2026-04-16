import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { getRiotClient } from '@/services/riotService';
import { findRankedEntry } from '@/lib/riotUtils';
import { normalizeLP } from '@/lib/normalizeLP';
import { PointTransaction } from '@/db/models/PointTransaction';
import { logger } from '@/lib/logger';
import type { PlayerDocument } from '@/types/Player';
import type { RegisterPlayerRequest } from '@/types/User';

function normalizeSearchTerm(search?: string): string {
  return search?.trim() ?? '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
      logger.info(
        {
          discordId,
          riotId: existing.riotId,
          puuid: existing.puuid,
          tier: ranked?.tier ?? 'UNRANKED',
          rank: ranked?.rank ?? '',
          leaguePoints: ranked?.leaguePoints ?? 0,
          wins: ranked?.wins ?? 0,
          losses: ranked?.losses ?? 0,
        },
        '[player] Fetched ranked player info from Riot for reactivation',
      );

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

      logger.info(
        {
          discordId: existing.discordId,
          riotId: existing.riotId,
          puuid: existing.puuid,
          godSlug: existing.godSlug,
          tier: existing.currentTier,
          rank: existing.currentRank,
          leaguePoints: existing.currentLP,
          wins: existing.currentWins,
          losses: existing.currentLosses,
        },
        '[player] Reactivated player registration',
      );

      return existing;
    }
    throw new Error(`Player with discordId ${discordId} is already registered.`);
  }

  const riot = getRiotClient();
  const puuid = await riot.getPuuidByRiotId(gameName, tagLine);
  logger.info({ discordId, riotId: `${gameName}#${tagLine}`, puuid }, '[player] Fetched Riot account PUUID for registration');

  const existingByPuuid = await Player.findOne({ puuid });
  if (existingByPuuid) {
    throw new Error(`Player with Riot account ${gameName}#${tagLine} is already registered.`);
  }

  const leagueEntries = await riot.getTftLeagueByPuuid(puuid);
  const ranked = findRankedEntry(leagueEntries);
  logger.info(
    {
      discordId,
      riotId: `${gameName}#${tagLine}`,
      puuid,
      tier: ranked?.tier ?? 'UNRANKED',
      rank: ranked?.rank ?? '',
      leaguePoints: ranked?.leaguePoints ?? 0,
      wins: ranked?.wins ?? 0,
      losses: ranked?.losses ?? 0,
    },
    '[player] Fetched ranked player info from Riot for registration',
  );

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
      losses:        ranked.losses
    });
  }

  logger.info(
    {
      discordId: player.discordId,
      riotId: player.riotId,
      puuid: player.puuid,
      godSlug: player.godSlug,
      tier: player.currentTier,
      rank: player.currentRank,
      leaguePoints: player.currentLP,
      wins: player.currentWins,
      losses: player.currentLosses,
    },
    '[player] Registered player',
  );

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

export async function searchActivePlayers(search?: string): Promise<PlayerDocument[]> {
  const normalizedSearch = normalizeSearchTerm(search);
  if (!normalizedSearch) return listActivePlayers();

  const pattern = new RegExp(escapeRegex(normalizedSearch), 'i');

  return Player.find({
    isActive: true,
    $or: [
      { gameName: pattern },
      { tagLine: pattern },
      { riotId: pattern },
      { discordUsername: pattern },
    ],
  });
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

export interface ResetAllPlayerRanksResult {
  processed: number;
  reset: number;
  snapshotsCleared: number;
  matchesCleared: number;
  pointTransactionsCleared: number;
  dailyScoresCleared: number;
}

export async function resetAllPlayerRankBaselines(): Promise<ResetAllPlayerRanksResult> {
  const processed = await Player.countDocuments({});

  const [playerUpdate, snapshotsDelete, matchesDelete, pointTransactionsDelete, dailyScoresDelete] = await Promise.all([
    Player.updateMany(
      {},
      {
        $set: {
          currentTier: 'UNRANKED',
          currentRank: '',
          currentLP: 0,
          currentWins: 0,
          currentLosses: 0,
          lpBaselineNorm: normalizeLP('UNRANKED', '', 0),
          lpBaselineOffset: 0,
        },
      },
    ),
    LpSnapshot.deleteMany({}),
    MatchRecord.deleteMany({}),
    PointTransaction.deleteMany({}),
    DailyPlayerScore.deleteMany({}),
  ]);

  return {
    processed,
    reset: playerUpdate.modifiedCount,
    snapshotsCleared: snapshotsDelete.deletedCount,
    matchesCleared: matchesDelete.deletedCount,
    pointTransactionsCleared: pointTransactionsDelete.deletedCount,
    dailyScoresCleared: dailyScoresDelete.deletedCount,
  };
}
