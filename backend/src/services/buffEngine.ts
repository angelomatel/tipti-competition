import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { getActiveGods } from '@/services/godService';
import { getTournamentSettings } from '@/services/tournamentService';
import {
  BUFF_DAILY_CAP,
  VARUS_TOP_BONUS,
  VARUS_BOTTOM_BONUS,
  EVELYNN_BASE_BONUS,
  EVELYNN_HIGH_BONUS,
  EVELYNN_GAIN_THRESHOLD,
  THRESH_PAIR_BONUS,
  YASUO_HIGH_BONUS,
  YASUO_HIGH_THRESHOLD,
  YASUO_LOW_PENALTY,
  YASUO_LOW_THRESHOLD,
  SORAKA_PLAYER_CAP,
  AHRI_PER_FIRST,
  AHRI_DAILY_CAP,
  ASOL_BONUS_MIN,
  ASOL_BONUS_MAX,
  ASOL_RANDOM_PLAYERS_MIN,
  ASOL_RANDOM_PLAYERS_MAX,
} from '@/constants';
import type { IDailyPlayerScore } from '@/types/God';
import { logger } from '@/lib/logger';

interface BuffResult {
  playerId: string;
  value: number;
  source: string;
  type: 'buff' | 'penalty';
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function processEndOfDayBuffs(day: string): Promise<void> {
  const settings = await getTournamentSettings();
  if (!settings.buffsEnabled) {
    logger.debug('Buffs not enabled, skipping');
    return;
  }

  const currentPhase = settings.currentPhase;
  const activeGods = await getActiveGods();

  for (const god of activeGods) {
    const dailyScores = await DailyPlayerScore.find({ godSlug: god.slug, day }).lean();
    if (dailyScores.length === 0) continue;

    let buffs: BuffResult[] = [];

    switch (god.slug) {
      case 'varus':
        buffs = computeVarusBuff(dailyScores);
        break;
      case 'evelynn':
        buffs = computeEvelynnBuff(dailyScores);
        break;
      case 'thresh':
        buffs = computeThreshBuff(dailyScores);
        break;
      case 'yasuo':
        buffs = computeYasuoBuff(dailyScores);
        break;
      case 'soraka':
        buffs = computeSorakaBuff(dailyScores);
        break;
      case 'ahri':
        buffs = computeAhriBuff(dailyScores);
        break;
      case 'aurelion_sol':
        buffs = computeAsolBuff(dailyScores);
        break;
      // ekko and kayle are handled at end of phase/tournament
    }

    // Apply daily cap
    const totalPositive = buffs.filter((b) => b.value > 0).reduce((s, b) => s + b.value, 0);
    const scaleFactor = totalPositive > BUFF_DAILY_CAP ? BUFF_DAILY_CAP / totalPositive : 1;

    for (const buff of buffs) {
      const scaledValue = buff.value > 0
        ? Math.round(buff.value * scaleFactor)
        : buff.value; // penalties not capped

      if (scaledValue === 0) continue;

      await PointTransaction.create({
        playerId: buff.playerId,
        godSlug: god.slug,
        type: buff.type,
        value: scaledValue,
        source: buff.source,
        day,
        phase: currentPhase,
      });
    }

    logger.debug(`Processed ${buffs.length} buff(s) for ${god.name} on ${day}`);
  }
}

function computeVarusBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const played = scores.filter((s) => s.matchCount > 0);
  if (played.length === 0) return [];

  const sorted = [...played].sort((a, b) => b.rawLpGain - a.rawLpGain);
  const results: BuffResult[] = [];

  // Top 1
  results.push({
    playerId: sorted[0].playerId,
    value: VARUS_TOP_BONUS,
    source: 'varus_top',
    type: 'buff',
  });

  // Bottom 1 (if different from top)
  const bottom = sorted[sorted.length - 1];
  if (bottom.playerId !== sorted[0].playerId) {
    results.push({
      playerId: bottom.playerId,
      value: VARUS_BOTTOM_BONUS,
      source: 'varus_bottom',
      type: 'buff',
    });
  }

  return results;
}

function computeEvelynnBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const played = scores.filter((s) => s.matchCount > 0);
  if (played.length === 0) return [];

  const sorted = [...played].sort((a, b) => b.rawLpGain - a.rawLpGain);
  const top = sorted[0];
  const bonus = top.rawLpGain >= EVELYNN_GAIN_THRESHOLD
    ? EVELYNN_BASE_BONUS + EVELYNN_HIGH_BONUS
    : EVELYNN_BASE_BONUS;

  return [{
    playerId: top.playerId,
    value: bonus,
    source: top.rawLpGain >= EVELYNN_GAIN_THRESHOLD ? 'evelynn_high' : 'evelynn_base',
    type: 'buff',
  }];
}

function computeThreshBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const played = scores.filter((s) => s.matchCount > 0);
  if (played.length < 2) return [];

  const sorted = [...played].sort((a, b) => b.rawLpGain - a.rawLpGain);
  return [
    { playerId: sorted[0].playerId, value: THRESH_PAIR_BONUS, source: 'thresh_pair', type: 'buff' },
    { playerId: sorted[1].playerId, value: THRESH_PAIR_BONUS, source: 'thresh_pair', type: 'buff' },
  ];
}

function computeYasuoBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const results: BuffResult[] = [];
  for (const score of scores) {
    if (score.matchCount === 0) continue;

    if (score.rawLpGain >= YASUO_HIGH_THRESHOLD) {
      results.push({
        playerId: score.playerId,
        value: YASUO_HIGH_BONUS,
        source: 'yasuo_high',
        type: 'buff',
      });
    } else if (score.rawLpGain <= YASUO_LOW_THRESHOLD) {
      results.push({
        playerId: score.playerId,
        value: YASUO_LOW_PENALTY,
        source: 'yasuo_penalty',
        type: 'penalty',
      });
    }
  }
  return results;
}

function computeSorakaBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const results: BuffResult[] = [];

  for (const score of scores) {
    if (score.placements.length === 0) continue;

    // Only the latest (final) streak of the day counts
    const lastPlacement = score.placements[score.placements.length - 1];
    const isWinStreak = lastPlacement <= 4;

    let streakLen = 0;
    for (let i = score.placements.length - 1; i >= 0; i--) {
      const p = score.placements[i];
      if (isWinStreak ? p <= 4 : p >= 5) {
        streakLen++;
      } else {
        break;
      }
    }

    const capped = Math.min(streakLen, SORAKA_PLAYER_CAP);
    if (capped === 0) continue;

    if (isWinStreak) {
      results.push({
        playerId: score.playerId,
        value: capped,
        source: 'soraka_streak',
        type: 'buff',
      });
    } else {
      results.push({
        playerId: score.playerId,
        value: -capped,
        source: 'soraka_loss_streak',
        type: 'penalty',
      });
    }
  }

  return results;
}

function computeAhriBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const results: BuffResult[] = [];

  for (const score of scores) {
    const firstPlaces = score.placements.filter((p) => p === 1).length;
    if (firstPlaces === 0) continue;

    const raw = firstPlaces * AHRI_PER_FIRST;
    const value = Math.min(raw, AHRI_DAILY_CAP);

    results.push({
      playerId: score.playerId,
      value,
      source: 'ahri_first_place',
      type: 'buff',
    });
  }

  return results;
}

function computeAsolBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const played = scores.filter((s) => s.matchCount > 0);
  if (played.length === 0) return [];

  const sorted = [...played].sort((a, b) => b.rawLpGain - a.rawLpGain);
  const results: BuffResult[] = [];

  // Top 1 gets random bonus
  results.push({
    playerId: sorted[0].playerId,
    value: randomInt(ASOL_BONUS_MIN, ASOL_BONUS_MAX),
    source: 'asol_top',
    type: 'buff',
  });

  // Random 1-3 players from top 2-10
  if (sorted.length > 1) {
    const candidates = sorted.slice(1, Math.min(10, sorted.length));
    const count = randomInt(
      ASOL_RANDOM_PLAYERS_MIN,
      Math.min(ASOL_RANDOM_PLAYERS_MAX, candidates.length),
    );
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      results.push({
        playerId: shuffled[i].playerId,
        value: randomInt(ASOL_BONUS_MIN, ASOL_BONUS_MAX),
        source: 'asol_random',
        type: 'buff',
      });
    }
  }

  return results;
}
