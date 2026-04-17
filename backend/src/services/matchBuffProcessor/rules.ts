import {
  AHRI_PER_FIRST,
  ASOL_BASE_UPPER,
  ASOL_SHIFT_CAP,
  BUFF_DAILY_CAP,
  EKKO_FLAT_PER_MATCH,
  EKKO_REPEAT_BONUS,
  EVELYNN_FLAT_PER_MATCH,
  EVELYNN_HIGH_LP_PER_MATCH,
  EVELYNN_LP_DEFAULT_THRESHOLD,
  EVELYNN_LP_TIER_THRESHOLDS,
  GOD_DAILY_CAP_OVERRIDES,
  KAYLE_ACTIVITY_BONUS,
  KAYLE_ACTIVITY_MIN_MATCHES,
  KAYLE_FLAT_PER_MATCH,
  SORAKA_LOSS_STREAK_PER,
  SORAKA_STREAK_CAP,
  SORAKA_WIN_STREAK_PER,
  THRESH_FLAT_PER_MATCH,
  THRESH_MATCH_BONUS,
  THRESH_TOP1_FLAT,
  VARUS_FLAT_PER_MATCH,
  VARUS_TOP10_BONUS,
  VARUS_TOP_N,
  YASUO_PLACEMENT_BONUSES,
} from '@/constants';
import { TIER_ORDER } from '@/lib/normalizeLP';

import type {
  BuffEntry,
  LeanMatchRecord,
  MatchStreakState,
  PlayerContext,
} from '@/services/matchBuffProcessor/types';

export function getDailyCap(godSlug: string): number {
  return GOD_DAILY_CAP_OVERRIDES[godSlug] ?? BUFF_DAILY_CAP;
}

export function buildMatchBuffEntries(params: {
  match: LeanMatchRecord;
  player: PlayerContext;
  matchDay: string;
  rankingsByGod: Map<string, Map<string, number>>;
  previousPlacementByMatchId: Map<string, number | null>;
  dailyLpGainByKey: Map<string, number>;
  threshTop1PlacementByDay: Map<string, number | null>;
  streakByMatchId: Map<string, MatchStreakState>;
  matchesByPuuidDay: Map<string, LeanMatchRecord[]>;
  kayleActivityAwarded: Set<string>;
}): BuffEntry[] {
  const { match, matchDay, player } = params;

  switch (player.godSlug) {
    case 'varus': {
      const rankings = params.rankingsByGod.get('varus') ?? new Map<string, number>();
      return computeVarusMatchBuff(rankings.get(player.discordId) ?? 999);
    }
    case 'ekko':
      return computeEkkoMatchBuff(
        match.placement,
        params.previousPlacementByMatchId.get(match.matchId) ?? null,
      );
    case 'evelynn': {
      const dailyLpGain = params.dailyLpGainByKey.get(`${match.puuid}:${matchDay}`) ?? 0;
      const tierOrder = TIER_ORDER[player.currentTier as keyof typeof TIER_ORDER] ?? 0;
      return computeEvelynnMatchBuff(dailyLpGain, tierOrder);
    }
    case 'thresh': {
      const rankings = params.rankingsByGod.get('thresh') ?? new Map<string, number>();
      const rank = rankings.get(player.discordId) ?? 999;
      const isTop1 = rank === 1;
      const top1Placement = isTop1 ? null : (params.threshTop1PlacementByDay.get(matchDay) ?? null);
      return computeThreshMatchBuff(match.placement, isTop1, top1Placement);
    }
    case 'yasuo':
      return computeYasuoMatchBuff(match.placement);
    case 'soraka': {
      const streak = params.streakByMatchId.get(match.matchId) ?? { count: 0, isWin: true };
      const isWin = match.placement <= 4;
      const effectiveCount = streak.count > 0 && streak.isWin === isWin ? streak.count : 0;
      return computeSorakaMatchBuff(effectiveCount, isWin);
    }
    case 'kayle': {
      const entries: BuffEntry[] = [
        { value: KAYLE_FLAT_PER_MATCH, source: 'kayle_flat', type: 'buff' },
      ];
      const totalKey = `${player.discordId}:${matchDay}`;
      const matchesToday = params.matchesByPuuidDay.get(`${match.puuid}:${matchDay}`)?.length ?? 0;
      if (matchesToday >= KAYLE_ACTIVITY_MIN_MATCHES && !params.kayleActivityAwarded.has(totalKey)) {
        entries.push({ value: KAYLE_ACTIVITY_BONUS, source: 'kayle_activity', type: 'buff' });
        params.kayleActivityAwarded.add(totalKey);
      }
      return entries;
    }
    case 'ahri':
      return computeAhriMatchBuff(match.placement);
    case 'aurelion_sol':
      return computeAsolMatchBuff(match.placement);
    default:
      return [];
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getEvelynnLpThreshold(tierOrder: number): number {
  for (const tier of EVELYNN_LP_TIER_THRESHOLDS) {
    if (tierOrder <= tier.maxTierOrder) return tier.lp;
  }
  return EVELYNN_LP_DEFAULT_THRESHOLD;
}

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
