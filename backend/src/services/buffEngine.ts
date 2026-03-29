import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { getActiveGods } from '@/services/godService';
import { getTournamentSettings } from '@/services/tournamentService';
import {
  BUFF_DAILY_CAP,
  VARUS_TOP_BONUS,
  VARUS_EMBRACE_BONUS,
  EVELYNN_BASE_BONUS,
  EVELYNN_HIGH_BONUS,
  EVELYNN_GAIN_THRESHOLD,
  EVELYNN_WHISPER_BONUS,
  THRESH_PAIR_BONUS,
  THRESH_COVENANT_BONUS,
  YASUO_HIGH_BONUS,
  YASUO_HIGH_THRESHOLD,
  YASUO_LOW_PENALTY,
  YASUO_LOW_THRESHOLD,
  SORAKA_PLAYER_CAP,
  KAYLE_DISCIPLINE_BONUS,
  KAYLE_DISCIPLINE_MIN_MATCHES,
  AHRI_PER_FIRST,
  AHRI_DAILY_CAP,
  ASOL_BONUS_MIN,
  ASOL_BONUS_MAX,
  ASOL_STARDUST_MIN,
  ASOL_STARDUST_MAX,
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
      case 'kayle':
        buffs = computeKayleDailyBuff(dailyScores);
        break;
      // ekko is handled at end of phase, kayle also has tournament-end bonuses
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

  // Top 1 — Beloved
  results.push({
    playerId: sorted[0].playerId,
    value: VARUS_TOP_BONUS,
    source: 'varus_top',
    type: 'buff',
  });

  // All players — Embrace
  for (const score of played) {
    results.push({
      playerId: score.playerId,
      value: VARUS_EMBRACE_BONUS,
      source: 'varus_embrace',
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
  const results: BuffResult[] = [];

  // Top 1 — Seduction
  const bonus = top.rawLpGain >= EVELYNN_GAIN_THRESHOLD
    ? EVELYNN_BASE_BONUS + EVELYNN_HIGH_BONUS
    : EVELYNN_BASE_BONUS;

  results.push({
    playerId: top.playerId,
    value: bonus,
    source: top.rawLpGain >= EVELYNN_GAIN_THRESHOLD ? 'evelynn_high' : 'evelynn_base',
    type: 'buff',
  });

  // All others — Whisper
  for (const score of played) {
    if (score.playerId === top.playerId) continue;
    results.push({
      playerId: score.playerId,
      value: EVELYNN_WHISPER_BONUS,
      source: 'evelynn_whisper',
      type: 'buff',
    });
  }

  return results;
}

function computeThreshBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const played = scores.filter((s) => s.matchCount > 0);
  if (played.length === 0) return [];

  const sorted = [...played].sort((a, b) => b.rawLpGain - a.rawLpGain);
  const results: BuffResult[] = [];

  // Top 2 — Soul Bond
  if (sorted.length >= 2) {
    results.push(
      { playerId: sorted[0].playerId, value: THRESH_PAIR_BONUS, source: 'thresh_pair', type: 'buff' },
      { playerId: sorted[1].playerId, value: THRESH_PAIR_BONUS, source: 'thresh_pair', type: 'buff' },
    );
  }

  // All players — Covenant
  for (const score of played) {
    results.push({
      playerId: score.playerId,
      value: THRESH_COVENANT_BONUS,
      source: 'thresh_covenant',
      type: 'buff',
    });
  }

  return results;
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

  // Top 1 — Supernova
  results.push({
    playerId: sorted[0].playerId,
    value: randomInt(ASOL_BONUS_MIN, ASOL_BONUS_MAX),
    source: 'asol_top',
    type: 'buff',
  });

  // All players — Stardust
  for (const score of played) {
    results.push({
      playerId: score.playerId,
      value: randomInt(ASOL_STARDUST_MIN, ASOL_STARDUST_MAX),
      source: 'asol_stardust',
      type: 'buff',
    });
  }

  return results;
}

function computeKayleDailyBuff(scores: IDailyPlayerScore[]): BuffResult[] {
  const results: BuffResult[] = [];

  for (const score of scores) {
    if (score.matchCount >= KAYLE_DISCIPLINE_MIN_MATCHES) {
      results.push({
        playerId: score.playerId,
        value: KAYLE_DISCIPLINE_BONUS,
        source: 'kayle_discipline',
        type: 'buff',
      });
    }
  }

  return results;
}
