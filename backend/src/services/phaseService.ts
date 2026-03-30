import { PointTransaction } from '@/db/models/PointTransaction';
import { Player } from '@/db/models/Player';
import { getGodStandings, eliminateGod } from '@/services/godService';
import { getTournamentSettings } from '@/services/tournamentService';
import { GOD_PLACEMENT_BONUSES } from '@/constants';
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

  // Advance to next phase
  settings.currentPhase = phase + 1;
  if (phase >= 1) settings.buffsEnabled = true;
  await settings.save();

  return eliminations;
}

export async function processEndOfTournament(): Promise<void> {
  const settings = await getTournamentSettings();

  const lastPhase = settings.phases[settings.phases.length - 1];
  const day = lastPhase?.endDay ?? '';

  // God placement bonuses
  await applyGodPlacementBonuses(day);

  logger.info('End of tournament processing complete');
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
