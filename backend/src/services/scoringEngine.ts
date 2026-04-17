import { PointTransaction } from '@/db/models/PointTransaction';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { Player } from '@/db/models/Player';
import { GOD_SCORE_TOP_N } from '@/constants';
import { normalizeLP } from '@/lib/normalizeLP';
import { getCurrentPhtDay } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import type { TournamentSettingsDocument } from '@/db/models/TournamentSettings';
import type { PlayerDocument } from '@/types/Player';
import type { PlayerScoreBreakdown, DailyPointEntry } from '@/types/Scoring';

type LpStatus = 'known' | 'unknown' | 'none';

export interface LpDeltaAttributionMatch {
  matchId: string;
  placement: number;
  playedAt: Date;
}

export interface CreateLpDeltaTransactionOptions {
  newMatches?: LpDeltaAttributionMatch[];
}

export async function computePlayerScore(discordId: string): Promise<number> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function computePlayerScoreTotals(playerIds: string[]): Promise<Map<string, number>> {
  if (playerIds.length === 0) return new Map();

  const rows = await PointTransaction.aggregate<{ _id: string; total: number }>([
    { $match: { playerId: { $in: playerIds } } },
    { $group: { _id: '$playerId', total: { $sum: '$value' } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.total]));
}

export async function computePlayerDailyPointGainTotals(playerIds: string[], day: string): Promise<Map<string, number>> {
  if (playerIds.length === 0) return new Map();

  const rows = await PointTransaction.aggregate<{ _id: string; total: number }>([
    { $match: { playerId: { $in: playerIds }, day } },
    { $group: { _id: '$playerId', total: { $sum: '$value' } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.total]));
}

export async function computePlayerScoreBreakdown(discordId: string): Promise<PlayerScoreBreakdown> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$value' },
      },
    },
  ]);

  const breakdown: PlayerScoreBreakdown = {
    match: 0,
    buff: 0,
    penalty: 0,
    godPlacementBonus: 0,
    total: 0,
  };

  for (const row of result) {
    switch (row._id) {
      case 'match':               breakdown.match = row.total; break;
      case 'buff':                breakdown.buff = row.total; break;
      case 'penalty':             breakdown.penalty = row.total; break;
      case 'god_placement_bonus': breakdown.godPlacementBonus = row.total; break;
    }
  }
  breakdown.total = breakdown.match + breakdown.buff + breakdown.penalty + breakdown.godPlacementBonus;
  return breakdown;
}

export async function computePlayerDailyBreakdown(discordId: string): Promise<DailyPointEntry[]> {
  const player = await Player.findOne({ discordId }).lean();
  const transactions = await PointTransaction.find({ playerId: discordId })
    .sort({ day: 1, createdAt: 1 })
    .lean();

  const matchById = new Map<string, { placement: number; playedAt: Date }>();
  if (player?.puuid) {
    const matches = await MatchRecord.find({ puuid: player.puuid })
      .select({ matchId: 1, placement: 1, playedAt: 1, lpAttributionStatus: 1 })
      .lean();
    for (const match of matches) {
      matchById.set(match.matchId, {
        placement: match.placement,
        playedAt: match.playedAt,
      });
    }
  }

  const dayMap = new Map<string, DailyPointEntry>();
  for (const tx of transactions) {
    let entry = dayMap.get(tx.day);
    if (!entry) {
      entry = { day: tx.day, transactions: [] };
      dayMap.set(tx.day, entry);
    }
    entry.transactions.push({
      type: tx.type,
      value: tx.value,
      source: tx.source,
      matchId: tx.matchId,
      placement: tx.matchId ? matchById.get(tx.matchId)?.placement : undefined,
      playedAt: tx.matchId ? matchById.get(tx.matchId)?.playedAt : undefined,
      lpStatus: resolveLpStatus(tx.source, tx.matchId ? 'known' : 'none'),
    });
  }

  if (player?.puuid) {
    const ambiguousMatches = await MatchRecord.find({
      puuid: player.puuid,
      lpAttributionStatus: 'ambiguous',
    })
      .select({ matchId: 1, placement: 1, playedAt: 1 })
      .lean();

    const ambiguousByDay = new Map<string, typeof ambiguousMatches>();
    for (const match of ambiguousMatches) {
      const day = getCurrentPhtDayForDate(match.playedAt);
      const entries = ambiguousByDay.get(day) ?? [];
      entries.push(match);
      ambiguousByDay.set(day, entries);
    }

    for (const [day, matches] of ambiguousByDay.entries()) {
      let entry = dayMap.get(day);
      if (!entry) {
        entry = { day, transactions: [] };
        dayMap.set(day, entry);
      }

      const existingMatchIds = new Set(entry.transactions.map((tx) => tx.matchId).filter(Boolean));
      for (const match of matches) {
        if (existingMatchIds.has(match.matchId)) continue;
        entry.transactions.push({
          type: 'match',
          value: 0,
          source: 'lp_delta',
          matchId: match.matchId,
          placement: match.placement,
          playedAt: match.playedAt,
          lpStatus: 'unknown',
        });
      }

      entry.transactions.sort((a, b) => {
        const aTime = a.playedAt ? new Date(a.playedAt).getTime() : 0;
        const bTime = b.playedAt ? new Date(b.playedAt).getTime() : 0;
        return aTime - bTime;
      });
    }
  }

  return Array.from(dayMap.values());
}

export async function computePlayerDailyPointGain(discordId: string, day: string): Promise<number> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId: discordId, day } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  return result[0]?.total ?? 0;
}

export async function computeGodScore(godSlug: string): Promise<number> {
  const players = await Player.find({
    godSlug,
    isActive: true,
    isEliminatedFromGod: false,
  });

  if (players.length === 0) return 0;

  const scores: number[] = [];
  for (const player of players) {
    scores.push(await computePlayerScore(player.discordId));
  }

  scores.sort((a, b) => b - a);

  const n = Math.min(
    GOD_SCORE_TOP_N.MAX,
    Math.max(GOD_SCORE_TOP_N.MIN, Math.floor(players.length / 3)),
  );
  const topN = scores.slice(0, n);
  return topN.reduce((sum, s) => sum + s, 0) / topN.length;
}

/**
 * Creates a match PointTransaction for the LP delta since the last scoring.
 * Self-correcting: compares (currentLP - baselineLP) against sum of existing match transactions.
 */
export async function createLpDeltaTransaction(
  player: PlayerDocument,
  settings: TournamentSettingsDocument,
  options: CreateLpDeltaTransactionOptions = {},
): Promise<void> {
  if (!player.godSlug) return;

  const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);
  let expectedTotal: number;

  if (player.lpBaselineNorm !== null && player.lpBaselineNorm !== undefined) {
    expectedTotal = player.lpBaselineOffset + (currentNorm - player.lpBaselineNorm);
  } else {
    // Tournament baseline: first snapshot on/after startDate
    const baseline = await LpSnapshot.findOne({
      puuid: player.puuid,
      capturedAt: { $gte: settings.startDate },
    }).sort({ capturedAt: 1 });

    if (!baseline) return;

    const baseNorm = normalizeLP(baseline.tier, baseline.rank, baseline.leaguePoints);
    expectedTotal = currentNorm - baseNorm;
  }

  // Sum existing match transactions
  const result = await PointTransaction.aggregate([
    { $match: { playerId: player.discordId, type: 'match' } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  const existingTotal = result[0]?.total ?? 0;

  const delta = expectedTotal - existingTotal;
  if (delta === 0) return;

  const today = getCurrentPhtDay();
  const phase = settings.phases.find((p) => today >= p.startDay && today <= p.endDay);

  const newMatches = [...(options.newMatches ?? [])].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const targetMatch = newMatches.length > 0 ? newMatches[newMatches.length - 1] : null;
  const matchId = targetMatch?.matchId ?? null;
  const playerLabel = getPlayerLogLabel(player);
  const transaction = {
    playerId: player.discordId,
    godSlug: player.godSlug,
    type: 'match' as const,
    value: delta,
    source: 'lp_delta',
    matchId,
    day: today,
    phase: phase?.phase ?? settings.currentPhase,
  };

  if (matchId) {
    try {
      const result = await PointTransaction.updateOne(
        {
          playerId: player.discordId,
          source: 'lp_delta',
          type: 'match',
          matchId,
        },
        { $setOnInsert: transaction },
        { upsert: true },
      );

      if (!result.upsertedCount) {
        logger.warn(
          {
            discordId: player.discordId,
            riotId: player.riotId ?? null,
            godSlug: player.godSlug,
            value: delta,
            source: 'lp_delta',
            matchId,
          },
          `[scoring] Skipped duplicate LP delta transaction for ${playerLabel} via match ${matchId}`,
        );
        return;
      }

      await applyLpAttribution(player.puuid, newMatches, true);

      logger.info(
        {
          discordId: player.discordId,
          riotId: player.riotId ?? null,
          ...transaction,
        },
        `[scoring] Created LP delta transaction of ${delta} for ${playerLabel} via match ${matchId}`,
      );
      return;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        logger.warn(
          {
            discordId: player.discordId,
            riotId: player.riotId ?? null,
            godSlug: player.godSlug,
            value: delta,
            source: 'lp_delta',
            matchId,
          },
          `[scoring] Skipped duplicate LP delta transaction for ${playerLabel} via match ${matchId}`,
        );
        return;
      }

      throw error;
    }
  }

  await PointTransaction.create(transaction);
  await applyLpAttribution(player.puuid, newMatches, Boolean(matchId));

  logger.info(
    {
      discordId: player.discordId,
      riotId: player.riotId ?? null,
      ...transaction,
    },
    `[scoring] Created LP delta transaction of ${delta} for ${playerLabel}${matchId ? ` via match ${matchId}` : ''}`,
  );
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: unknown }).code === 11000;
}

function resolveLpStatus(source: string, lpStatus: LpStatus): LpStatus {
  if (source === 'lp_data' || source === 'lp_delta') {
    return lpStatus;
  }
  return 'none';
}

function getCurrentPhtDayForDate(date: Date): string {
  const phtDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return phtDate.toISOString().slice(0, 10);
}

async function applyLpAttribution(
  puuid: string,
  newMatches: LpDeltaAttributionMatch[],
  hasLinkedMatch: boolean,
): Promise<void> {
  if (newMatches.length === 0) return;

  const latestMatch = newMatches[newMatches.length - 1];
  const olderMatchIds = newMatches.slice(0, -1).map((match) => match.matchId);

  if (olderMatchIds.length > 0) {
    await MatchRecord.updateMany(
      { puuid, matchId: { $in: olderMatchIds } },
      { $set: { lpAttributionStatus: 'ambiguous', lpAttributionReason: 'multiple_matches_single_delta' } },
    );
  }

  if (!hasLinkedMatch || !latestMatch) return;

  await MatchRecord.updateOne(
    { puuid, matchId: latestMatch.matchId },
    { $set: { lpAttributionStatus: 'linked', lpAttributionReason: null } },
  );
}
