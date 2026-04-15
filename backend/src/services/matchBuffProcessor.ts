import { MatchRecord } from '@/db/models/MatchRecord';
import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerScore } from '@/services/scoringEngine';
import { normalizeLP, TIER_ORDER } from '@/lib/normalizeLP';
import { getTodayUTC8, getDayBoundsUTC8, dateToUTC8Str } from '@/lib/dateUtils';
import {
  BUFF_DAILY_CAP,
  GOD_DAILY_CAP_OVERRIDES,
  VARUS_FLAT_PER_MATCH,
  VARUS_TOP10_BONUS,
  VARUS_TOP_N,
  EKKO_FLAT_PER_MATCH,
  EKKO_REPEAT_BONUS,
  EVELYNN_FLAT_PER_MATCH,
  EVELYNN_HIGH_LP_PER_MATCH,
  EVELYNN_LP_TIER_THRESHOLDS,
  EVELYNN_LP_DEFAULT_THRESHOLD,
  THRESH_FLAT_PER_MATCH,
  THRESH_MATCH_BONUS,
  THRESH_TOP1_FLAT,
  YASUO_PLACEMENT_BONUSES,
  SORAKA_WIN_STREAK_PER,
  SORAKA_LOSS_STREAK_PER,
  SORAKA_STREAK_CAP,
  KAYLE_FLAT_PER_MATCH,
  KAYLE_ACTIVITY_BONUS,
  KAYLE_ACTIVITY_MIN_MATCHES,
  AHRI_PER_FIRST,
  ASOL_BASE_UPPER,
  ASOL_SHIFT_CAP,
} from '@/constants';
import { logger } from '@/lib/logger';
import type { MatchRecordDocument } from '@/types/Player';

// ── Types ────────────────────────────────────────────────────────────

interface BuffEntry {
  value: number;
  source: string;
  type: 'buff' | 'penalty';
}

interface PlayerContext {
  discordId: string;
  puuid: string;
  godSlug: string;
  currentTier: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDailyCap(godSlug: string): number {
  return GOD_DAILY_CAP_OVERRIDES[godSlug] ?? BUFF_DAILY_CAP;
}

function getEvelynnLpThreshold(tierOrder: number): number {
  for (const tier of EVELYNN_LP_TIER_THRESHOLDS) {
    if (tierOrder <= tier.maxTierOrder) return tier.lp;
  }
  return EVELYNN_LP_DEFAULT_THRESHOLD;
}

/** Get the sum of positive buff PointTransactions for a player+day. */
async function getPlayerDailyBuffTotal(playerId: string, day: string): Promise<number> {
  const result = await PointTransaction.aggregate([
    { $match: { playerId, day, type: 'buff' } },
    { $group: { _id: null, total: { $sum: '$value' } } },
  ]);
  return result[0]?.total ?? 0;
}

/** Get the placement from the most recent MatchRecord before a given date. */
async function getPreviousPlacement(puuid: string, beforeDate: Date): Promise<number | null> {
  const prev = await MatchRecord.findOne({
    puuid,
    playedAt: { $lt: beforeDate },
  }).sort({ playedAt: -1 });
  return prev?.placement ?? null;
}

/** Get number of matches played today (buffProcessed or not). */
async function getTodayMatchCount(puuid: string, dayStart: Date, dayEnd: Date): Promise<number> {
  return MatchRecord.countDocuments({
    puuid,
    playedAt: { $gte: dayStart, $lte: dayEnd },
  });
}

/** Check if Kayle activity bonus was already awarded today. */
async function hasKayleActivityBonus(playerId: string, day: string): Promise<boolean> {
  const existing = await PointTransaction.findOne({
    playerId,
    day,
    source: 'kayle_activity',
  });
  return !!existing;
}

/** Get current win/loss streak ending before a given date. Returns {count, isWin}. */
async function getCurrentStreak(puuid: string, beforeDate: Date): Promise<{ count: number; isWin: boolean }> {
  // Fetch recent matches before this one, sorted newest first
  const recentMatches = await MatchRecord.find({
    puuid,
    playedAt: { $lt: beforeDate },
  }).sort({ playedAt: -1 }).limit(SORAKA_STREAK_CAP);

  if (recentMatches.length === 0) return { count: 0, isWin: true };

  const firstPlacement = recentMatches[0].placement;
  const isWin = firstPlacement <= 4;

  let count = 0;
  for (const m of recentMatches) {
    const matchIsWin = m.placement <= 4;
    if (matchIsWin === isWin) {
      count++;
    } else {
      break;
    }
  }

  return { count, isWin };
}

/** Buffs only start once phase 2 begins. Matches before that are never eligible. */
function getBuffActivationStart(settings: Awaited<ReturnType<typeof getTournamentSettings>>): Date | null {
  const phase2 = settings.phases.find((p) => p.phase === 2);
  if (!phase2) return null;
  return getDayBoundsUTC8(phase2.startDay).dayStart;
}

/** Compute today's LP gain for a player from snapshots. */
async function getPlayerDailyLpGain(puuid: string, dayStart: Date, dayEnd: Date): Promise<number> {
  const firstSnapshot = await LpSnapshot.findOne({
    puuid,
    capturedAt: { $gte: dayStart, $lte: dayEnd },
  }).sort({ capturedAt: 1 });

  const lastSnapshot = await LpSnapshot.findOne({
    puuid,
    capturedAt: { $gte: dayStart, $lte: dayEnd },
  }).sort({ capturedAt: -1 });

  if (!firstSnapshot || !lastSnapshot) return 0;

  return normalizeLP(lastSnapshot.tier, lastSnapshot.rank, lastSnapshot.leaguePoints) -
    normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints);
}

/** Get god leaderboard rankings: Map<playerId, rank> (1-indexed). */
async function getGodRankings(godSlug: string): Promise<Map<string, number>> {
  const players = await Player.find({ godSlug, isActive: true });
  const scores = await Promise.all(
    players.map(async (p) => ({
      playerId: p.discordId,
      score: await computePlayerScore(p.discordId),
    })),
  );
  scores.sort((a, b) => b.score - a.score);

  const rankings = new Map<string, number>();
  scores.forEach((s, i) => rankings.set(s.playerId, i + 1));
  return rankings;
}

// ── Per-Match Buff Compute Functions ─────────────────────────────────

function computeVarusMatchBuff(rank: number): BuffEntry[] {
  const results: BuffEntry[] = [];
  results.push({ value: VARUS_FLAT_PER_MATCH, source: 'varus_flat', type: 'buff' });
  if (rank <= VARUS_TOP_N) {
    results.push({ value: VARUS_TOP10_BONUS, source: 'varus_top10', type: 'buff' });
  }
  return results;
}

function computeEkkoMatchBuff(placement: number, prevPlacement: number | null): BuffEntry[] {
  const results: BuffEntry[] = [];
  results.push({ value: EKKO_FLAT_PER_MATCH, source: 'ekko_flat', type: 'buff' });
  if (prevPlacement !== null && placement === prevPlacement) {
    results.push({ value: EKKO_REPEAT_BONUS, source: 'ekko_repeat', type: 'buff' });
  }
  return results;
}

function computeEvelynnMatchBuff(dailyLpGain: number, tierOrder: number): BuffEntry[] {
  const threshold = getEvelynnLpThreshold(tierOrder);
  if (dailyLpGain >= threshold) {
    return [{ value: EVELYNN_HIGH_LP_PER_MATCH, source: 'evelynn_high', type: 'buff' }];
  }
  return [{ value: EVELYNN_FLAT_PER_MATCH, source: 'evelynn_flat', type: 'buff' }];
}

function computeThreshMatchBuff(
  placement: number,
  isTop1: boolean,
  top1LatestPlacement: number | null,
): BuffEntry[] {
  if (isTop1) {
    return [{ value: THRESH_TOP1_FLAT, source: 'thresh_top1', type: 'buff' }];
  }

  const results: BuffEntry[] = [];
  results.push({ value: THRESH_FLAT_PER_MATCH, source: 'thresh_flat', type: 'buff' });
  if (top1LatestPlacement !== null && placement === top1LatestPlacement) {
    results.push({ value: THRESH_MATCH_BONUS, source: 'thresh_match', type: 'buff' });
  }
  return results;
}

function computeYasuoMatchBuff(placement: number): BuffEntry[] {
  if (placement < 5 || placement > 8) return [];
  const value = YASUO_PLACEMENT_BONUSES[placement - 5];
  return [{ value, source: `yasuo_${placement}th`, type: 'buff' }];
}

function computeSorakaMatchBuff(streakCount: number, isWinStreak: boolean): BuffEntry[] {
  // streakCount = number of consecutive same-direction matches BEFORE this one
  // Current match extends the streak, so effective position = streakCount + 1
  // Bonus = (position - 1) * per = streakCount * per
  const cappedStreak = Math.min(streakCount, SORAKA_STREAK_CAP - 1);
  if (cappedStreak === 0) return [];

  if (isWinStreak) {
    return [{ value: cappedStreak * SORAKA_WIN_STREAK_PER, source: 'soraka_streak', type: 'buff' }];
  }
  return [{ value: cappedStreak * SORAKA_LOSS_STREAK_PER, source: 'soraka_loss_streak', type: 'penalty' }];
}

function computeAhriMatchBuff(placement: number): BuffEntry[] {
  if (placement === 1) {
    return [{ value: AHRI_PER_FIRST, source: 'ahri_first_place', type: 'buff' }];
  }
  return [];
}

function computeAsolMatchBuff(placement: number): BuffEntry[] {
  const shift = -Math.min(placement - 1, ASOL_SHIFT_CAP);
  const lower = shift;
  const upper = ASOL_BASE_UPPER + shift;
  const value = randomInt(lower, upper);
  if (value === 0) return [];

  return [{
    value,
    source: 'asol_cosmic',
    type: value > 0 ? 'buff' : 'penalty',
  }];
}

// ── Main Processor ───────────────────────────────────────────────────

export async function processNewMatchBuffs(): Promise<void> {
  const settings = await getTournamentSettings();
  if (!settings.buffsEnabled) {
    logger.debug('[match-buff] Buffs not enabled, skipping');
    return;
  }

  const unprocessed = await MatchRecord.find({ buffProcessed: false }).sort({ playedAt: 1 });
  if (unprocessed.length === 0) return;

  logger.debug(`[match-buff] Processing ${unprocessed.length} unprocessed match(es)`);

  // Build player lookup: puuid → PlayerContext
  const puuids = [...new Set(unprocessed.map((m) => m.puuid))];
  const players = await Player.find({ puuid: { $in: puuids }, isActive: true });
  const playerByPuuid = new Map<string, PlayerContext>();
  for (const p of players) {
    if (!p.godSlug) continue;
    playerByPuuid.set(p.puuid, {
      discordId: p.discordId,
      puuid: p.puuid,
      godSlug: p.godSlug,
      currentTier: p.currentTier,
    });
  }

  // Pre-compute god rankings (cached for this cycle)
  const godSlugs = [...new Set([...playerByPuuid.values()].map((p) => p.godSlug))];
  const godRankingsCache = new Map<string, Map<string, number>>();
  for (const slug of godSlugs) {
    godRankingsCache.set(slug, await getGodRankings(slug));
  }

  // Pre-compute Thresh top 1 latest placement
  const threshTop1Placement = new Map<string, number | null>(); // day → placement
  const threshRankings = godRankingsCache.get('thresh');
  let threshTop1Id: string | null = null;
  if (threshRankings) {
    for (const [playerId, rank] of threshRankings) {
      if (rank === 1) { threshTop1Id = playerId; break; }
    }
  }

  // Determine current phase
  const today = getTodayUTC8();
  const phase = settings.phases.find((p) => today >= p.startDay && today <= p.endDay);
  const phaseNum = phase?.phase ?? settings.currentPhase;
  const buffActivationStart = getBuffActivationStart(settings);

  // Track running daily buff totals per player (to enforce cap across this batch)
  const dailyBuffTotals = new Map<string, number>(); // "playerId:day" → total

  for (const match of unprocessed) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) {
      // Player not active or no god — mark as processed and skip
      await MatchRecord.updateOne({ _id: match._id }, { buffProcessed: true });
      continue;
    }

    if (buffActivationStart && match.playedAt < buffActivationStart) {
      logger.debug(
        { matchId: match.matchId, playedAt: match.playedAt.toISOString(), buffActivationStart: buffActivationStart.toISOString() },
        '[match-buff] Match occurred before buff activation; marking processed without buffs',
      );
      await MatchRecord.updateOne({ _id: match._id }, { buffProcessed: true });
      continue;
    }

    const matchDay = dateToUTC8Str(match.playedAt);
    const { dayStart, dayEnd } = getDayBoundsUTC8(matchDay);
    const cap = getDailyCap(player.godSlug);

    // Get or initialize running daily total
    const totalKey = `${player.discordId}:${matchDay}`;
    if (!dailyBuffTotals.has(totalKey)) {
      dailyBuffTotals.set(totalKey, await getPlayerDailyBuffTotal(player.discordId, matchDay));
    }

    // Compute buff entries based on god
    let entries: BuffEntry[] = [];

    switch (player.godSlug) {
      case 'varus': {
        const rankings = godRankingsCache.get('varus')!;
        const rank = rankings.get(player.discordId) ?? 999;
        entries = computeVarusMatchBuff(rank);
        break;
      }
      case 'ekko': {
        const prevPlacement = await getPreviousPlacement(match.puuid, match.playedAt);
        entries = computeEkkoMatchBuff(match.placement, prevPlacement);
        break;
      }
      case 'evelynn': {
        const dailyLpGain = await getPlayerDailyLpGain(match.puuid, dayStart, dayEnd);
        const tierOrder = TIER_ORDER[player.currentTier as keyof typeof TIER_ORDER] ?? 0;
        entries = computeEvelynnMatchBuff(dailyLpGain, tierOrder);
        break;
      }
      case 'thresh': {
        const rankings = godRankingsCache.get('thresh')!;
        const rank = rankings.get(player.discordId) ?? 999;
        const isTop1 = rank === 1;

        // Get top 1's latest placement for today
        let top1Placement: number | null = null;
        if (!isTop1 && threshTop1Id) {
          const cacheKey = matchDay;
          if (!threshTop1Placement.has(cacheKey)) {
            const top1Player = players.find((p) => p.discordId === threshTop1Id);
            if (top1Player) {
              const latestMatch = await MatchRecord.findOne({
                puuid: top1Player.puuid,
                playedAt: { $gte: dayStart, $lte: dayEnd },
              }).sort({ playedAt: -1 });
              threshTop1Placement.set(cacheKey, latestMatch?.placement ?? null);
            } else {
              // Top 1 player not in current batch — look up directly
              const top1PlayerDoc = await Player.findOne({ discordId: threshTop1Id });
              if (top1PlayerDoc) {
                const latestMatch = await MatchRecord.findOne({
                  puuid: top1PlayerDoc.puuid,
                  playedAt: { $gte: dayStart, $lte: dayEnd },
                }).sort({ playedAt: -1 });
                threshTop1Placement.set(cacheKey, latestMatch?.placement ?? null);
              } else {
                threshTop1Placement.set(cacheKey, null);
              }
            }
          }
          top1Placement = threshTop1Placement.get(cacheKey) ?? null;
        }

        entries = computeThreshMatchBuff(match.placement, isTop1, top1Placement);
        break;
      }
      case 'yasuo': {
        entries = computeYasuoMatchBuff(match.placement);
        break;
      }
      case 'soraka': {
        const streak = await getCurrentStreak(match.puuid, match.playedAt);
        const isWin = match.placement <= 4;
        // If direction matches existing streak, extend it; otherwise reset
        const effectiveCount = (streak.count > 0 && streak.isWin === isWin) ? streak.count : 0;
        entries = computeSorakaMatchBuff(effectiveCount, isWin);
        break;
      }
      case 'kayle': {
        entries = [{ value: KAYLE_FLAT_PER_MATCH, source: 'kayle_flat', type: 'buff' }];
        const matchesToday = await getTodayMatchCount(match.puuid, dayStart, dayEnd);
        if (matchesToday >= KAYLE_ACTIVITY_MIN_MATCHES) {
          const alreadyAwarded = await hasKayleActivityBonus(player.discordId, matchDay);
          if (!alreadyAwarded) {
            entries.push({ value: KAYLE_ACTIVITY_BONUS, source: 'kayle_activity', type: 'buff' });
          }
        }
        break;
      }
      case 'ahri': {
        entries = computeAhriMatchBuff(match.placement);
        break;
      }
      case 'aurelion_sol': {
        entries = computeAsolMatchBuff(match.placement);
        break;
      }
    }

    // Apply daily cap and create transactions
    let currentTotal = dailyBuffTotals.get(totalKey)!;

    for (const entry of entries) {
      let finalValue = entry.value;

      if (finalValue > 0) {
        const remaining = cap - currentTotal;
        if (remaining <= 0) continue;
        finalValue = Math.min(finalValue, remaining);
        currentTotal += finalValue;
      }
      // Penalties pass through uncapped

      if (finalValue === 0) continue;

      await PointTransaction.create({
        playerId: player.discordId,
        godSlug: player.godSlug,
        type: entry.type,
        value: finalValue,
        source: entry.source,
        matchId: match.matchId,
        day: matchDay,
        phase: phaseNum,
      });
    }

    dailyBuffTotals.set(totalKey, currentTotal);
    await MatchRecord.updateOne({ _id: match._id }, { buffProcessed: true });
  }

  logger.debug(`[match-buff] Processed ${unprocessed.length} match buff(s)`);
}
