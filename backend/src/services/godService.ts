import { God } from '@/db/models/God';
import { Player } from '@/db/models/Player';
import { GOD_DEFINITIONS } from '@/constants';
import { computeGodScore } from '@/services/scoringEngine';
import type { GodDocument } from '@/types/God';
import type { GodStanding } from '@/types/God';
import type { PlayerDocument } from '@/types/Player';

export async function seedGods(): Promise<GodDocument[]> {
  const results: GodDocument[] = [];
  for (const def of GOD_DEFINITIONS) {
    const existing = await God.findOne({ slug: def.slug });
    if (existing) {
      results.push(existing);
    } else {
      results.push(await God.create(def));
    }
  }
  return results;
}

export async function listGods(): Promise<GodDocument[]> {
  return God.find().sort({ slug: 1 });
}

export async function getGodBySlug(slug: string): Promise<GodDocument | null> {
  return God.findOne({ slug });
}

export async function getActiveGods(): Promise<GodDocument[]> {
  return God.find({ isEliminated: false });
}

export async function assignPlayerToGod(discordId: string, godSlug: string): Promise<PlayerDocument> {
  const god = await God.findOne({ slug: godSlug });
  if (!god) throw new Error(`God "${godSlug}" not found.`);
  if (god.isEliminated) throw new Error(`God "${godSlug}" has been eliminated.`);

  const player = await Player.findOne({ discordId });
  if (!player) throw new Error(`Player "${discordId}" not found.`);

  player.godSlug = godSlug;
  player.isEliminatedFromGod = false;
  await player.save();
  return player;
}

export async function getPlayersForGod(godSlug: string): Promise<PlayerDocument[]> {
  return Player.find({ godSlug, isActive: true });
}

export async function eliminateGod(godSlug: string, phase: number): Promise<void> {
  const god = await God.findOne({ slug: godSlug });
  if (!god) throw new Error(`God "${godSlug}" not found.`);
  if (god.isEliminated) throw new Error(`God "${godSlug}" is already eliminated.`);

  god.isEliminated = true;
  god.eliminatedAt = new Date();
  god.eliminatedInPhase = phase;
  await god.save();

  await Player.updateMany(
    { godSlug, isActive: true },
    { $set: { isEliminatedFromGod: true } },
  );
}

export async function getGodStandings(): Promise<GodStanding[]> {
  const gods = await God.find().sort({ slug: 1 });
  const standings: GodStanding[] = [];

  for (const god of gods) {
    const playerCount = await Player.countDocuments({ godSlug: god.slug, isActive: true });
    const score = god.isEliminated ? 0 : await computeGodScore(god.slug);

    standings.push({
      slug: god.slug,
      name: god.name,
      title: god.title,
      score,
      playerCount,
      isEliminated: god.isEliminated,
    });
  }

  standings.sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    return b.score - a.score;
  });

  return standings;
}
