import type { Request, Response } from 'express';
import * as godService from '@/services/godService';
import { computePlayerScore } from '@/services/scoringEngine';
import { GOD_SLUGS } from '@/constants';

export async function listGods(req: Request, res: Response): Promise<void> {
  const standings = await godService.getGodStandings();
  res.json(standings);
}

export async function getGod(req: Request, res: Response): Promise<void> {
  const slug = req.params['slug'] as string;
  const god = await godService.getGodBySlug(slug);
  if (!god) {
    res.status(404).json({ error: `God "${slug}" not found.` });
    return;
  }

  const players = await godService.getPlayersForGod(slug);
  const playerScores = await Promise.all(
    players.map(async (p) => ({
      discordId: p.discordId,
      gameName: p.gameName,
      tagLine: p.tagLine,
      riotId: p.riotId,
      currentTier: p.currentTier,
      currentRank: p.currentRank,
      currentLP: p.currentLP,
      scorePoints: await computePlayerScore(p.discordId),
      discordAvatarUrl: p.discordAvatarUrl,
      discordUsername: p.discordUsername,
      isEliminatedFromGod: p.isEliminatedFromGod,
    }))
  );
  playerScores.sort((a, b) => b.scorePoints - a.scorePoints);

  res.json({
    god: {
      slug: god.slug,
      name: god.name,
      title: god.title,
      isEliminated: god.isEliminated,
      eliminatedInPhase: god.eliminatedInPhase,
    },
    players: playerScores,
  });
}

export async function seedGods(req: Request, res: Response): Promise<void> {
  const gods = await godService.seedGods();
  res.status(201).json(gods);
}

export async function assignGod(req: Request, res: Response): Promise<void> {
  const slug = req.params['slug'] as string;
  const { discordId } = req.body;
  if (!discordId) {
    res.status(400).json({ error: 'discordId is required.' });
    return;
  }
  if (!GOD_SLUGS.includes(slug)) {
    res.status(400).json({ error: `Invalid god slug "${slug}".` });
    return;
  }

  try {
    const player = await godService.assignPlayerToGod(discordId, slug);
    res.json({ discordId: player.discordId, godSlug: player.godSlug });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function eliminateGodHandler(req: Request, res: Response): Promise<void> {
  const slug = req.params['slug'] as string;
  const { phase } = req.body;
  if (typeof phase !== 'number') {
    res.status(400).json({ error: 'phase (number) is required.' });
    return;
  }

  try {
    await godService.eliminateGod(slug, phase);
    res.json({ slug, eliminated: true, phase });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getGodStandings(req: Request, res: Response): Promise<void> {
  const standings = await godService.getGodStandings();
  res.json({ standings, updatedAt: new Date().toISOString() });
}
