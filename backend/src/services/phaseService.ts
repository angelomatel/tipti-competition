import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { getGodStandings, eliminateGod, getPlayersForGod } from '@/services/godService';
import { computePlayerScore } from '@/services/scoringEngine';
import { getTournamentSettings } from '@/services/tournamentService';
import {
  EKKO_PHASE_FLAT_BONUS,
  AHRI_CAP,
  KAYLE_BONUSES,
  GOD_PLACEMENT_BONUSES,
} from '@/constants';
import { logger } from '@/lib/logger';

export interface EliminationResult {
  slug: string;
  name: string;
  phase: number;
}

export async function processEndOfPhase(phase: number): Promise<EliminationResult[]> {
  const settings = await getTournamentSettings();

  const phaseConfig = settings.phases.find((p) => p.phase === phase);
  if (!phaseConfig) throw new Error(`Phase ${phase} not configured.`);

  const eliminations: EliminationResult[] = [];

  // Eliminate bottom N gods
  if (phaseConfig.eliminationCount > 0) {
    const standings = await getGodStandings();
    const activeStandings = standings.filter((g) => !g.isEliminated);
    const toEliminate = activeStandings.slice(-phaseConfig.eliminationCount);

    for (const god of toEliminate) {
      await eliminateGod(god.slug, phase);
      eliminations.push({ slug: god.slug, name: god.name, phase });
      logger.info(`Eliminated god: ${god.name} (Phase ${phase})`);
    }
  }

  // Process Ekko's end-of-phase buff (rewind best day)
  await processEkkoBuff(phase);

  // Advance to next phase
  settings.currentPhase = phase + 1;
  if (phase >= 1) settings.buffsEnabled = true;
  await settings.save();

  return eliminations;
}

async function processEkkoBuff(phase: number): Promise<void> {
  const settings = await getTournamentSettings();
  const phaseConfig = settings.phases.find((p) => p.phase === phase);
  if (!phaseConfig) return;

  const ekkoPlayers = await Player.find({
    godSlug: 'ekko',
    isActive: true,
    isEliminatedFromGod: false,
  });

  for (const player of ekkoPlayers) {
    await PointTransaction.create({
      playerId: player.discordId,
      godSlug: 'ekko',
      type: 'buff',
      value: EKKO_PHASE_FLAT_BONUS,
      source: 'ekko_phase_bonus',
      day: phaseConfig.endDay,
      phase,
    });

    logger.info(`Ekko phase bonus: ${player.gameName} +${EKKO_PHASE_FLAT_BONUS} (Phase ${phase})`);
  }
}

export async function processEndOfTournament(): Promise<void> {
  const settings = await getTournamentSettings();

  const lastPhase = settings.phases[settings.phases.length - 1];
  const day = lastPhase?.endDay ?? '';

  // Kayle end-of-tournament buff
  await processKayleBuff(day);

  // Ahri cap enforcement (already accumulated daily, just verify cap)
  await enforceAhriCap();

  // God placement bonuses
  await applyGodPlacementBonuses(day);

  logger.info('End of tournament processing complete');
}

async function processKayleBuff(day: string): Promise<void> {
  const kaylePlayers = await getPlayersForGod('kayle');
  if (kaylePlayers.length === 0) return;

  const scores = await Promise.all(
    kaylePlayers.map(async (p) => ({
      playerId: p.discordId,
      score: await computePlayerScore(p.discordId),
    })),
  );
  scores.sort((a, b) => b.score - a.score);

  for (let i = 0; i < Math.min(5, scores.length); i++) {
    let bonus: number;
    if (i < 2) bonus = KAYLE_BONUSES.TOP_2;
    else if (i === 2) bonus = KAYLE_BONUSES.TOP_3;
    else bonus = KAYLE_BONUSES.TOP_5;

    await PointTransaction.create({
      playerId: scores[i].playerId,
      godSlug: 'kayle',
      type: 'buff',
      value: bonus,
      source: 'kayle_final',
      day,
      phase: 3,
    });
  }
}

async function enforceAhriCap(): Promise<void> {
  const ahriPlayers = await getPlayersForGod('ahri');

  for (const player of ahriPlayers) {
    const totalAhri = await PointTransaction.aggregate([
      { $match: { playerId: player.discordId, source: 'ahri_first_place' } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);
    const total = totalAhri[0]?.total ?? 0;

    if (total > AHRI_CAP) {
      const excess = total - AHRI_CAP;
      const settings = await getTournamentSettings();
      const lastPhase = settings.phases[settings.phases.length - 1];

      await PointTransaction.create({
        playerId: player.discordId,
        godSlug: 'ahri',
        type: 'penalty',
        value: -excess,
        source: 'ahri_cap_adjustment',
        day: lastPhase?.endDay ?? '',
        phase: 3,
      });
    }
  }
}

async function applyGodPlacementBonuses(day: string): Promise<void> {
  const standings = await getGodStandings();
  const activeStandings = standings.filter((g) => !g.isEliminated);

  for (let i = 0; i < Math.min(3, activeStandings.length); i++) {
    const god = activeStandings[i];
    const bonus = GOD_PLACEMENT_BONUSES[i];

    const players = await Player.find({
      godSlug: god.slug,
      isActive: true,
    });

    for (const player of players) {
      await PointTransaction.create({
        playerId: player.discordId,
        godSlug: god.slug,
        type: 'god_placement_bonus',
        value: bonus,
        source: `god_${i + 1}${i === 0 ? 'st' : i === 1 ? 'nd' : 'rd'}_place`,
        day,
        phase: 3,
      });
    }
  }
}
