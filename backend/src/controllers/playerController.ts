import type { Request, Response, NextFunction } from 'express';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { normalizeLP } from '@/lib/normalizeLP';
import { QUERY_LIMITS } from '@/constants';
import {
  registerPlayer,
  removePlayer,
  listActivePlayers,
  getPlayerByDiscordId,
} from '@/services/playerService';

export async function listPlayers(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const players = await listActivePlayers();
    res.json({ players });
  } catch (err) { next(err); }
}

export async function createPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const player = await registerPlayer(req.body);
    res.status(201).json({ player });
  } catch (err: any) {
    if (err.message?.includes('already registered')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function deletePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await removePlayer(req.params['discordId'] as string);
    res.status(204).send();
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
}

export async function getPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const player = await getPlayerByDiscordId(req.params['discordId'] as string);
    if (!player) { res.status(404).json({ error: 'Player not found.' }); return; }

    // Snapshots in ascending order (oldest first)
    const rawSnapshots = await LpSnapshot.find({ puuid: player.puuid })
      .sort({ capturedAt: 1 })
      .limit(QUERY_LIMITS.SNAPSHOTS);

    const snapshots = rawSnapshots.map((s) => ({
      capturedAt: s.capturedAt,
      tier: s.tier,
      rank: s.rank,
      leaguePoints: s.leaguePoints,
      normalizedLP: normalizeLP(s.tier, s.rank, s.leaguePoints),
      wins: s.wins,
      losses: s.losses,
    }));

    // Match records in ascending order
    const rawMatches = await MatchRecord.find({ puuid: player.puuid })
      .sort({ playedAt: 1 })
      .limit(QUERY_LIMITS.MATCHES);

    const matches = rawMatches.map((m) => ({
      matchId: m.matchId,
      placement: m.placement,
      playedAt: m.playedAt,
    }));

    // Build match-based LP points: for each match, find the nearest preceding snapshot
    const matchPoints = rawMatches.map((m) => {
      const matchTime = m.playedAt.getTime();
      // Find the latest snapshot captured before or at the match time
      let nearest = rawSnapshots[0];
      for (const s of rawSnapshots) {
        if (s.capturedAt.getTime() <= matchTime) {
          nearest = s;
        } else {
          break;
        }
      }
      if (!nearest) return null;
      return {
        playedAt: m.playedAt,
        placement: m.placement,
        matchId: m.matchId,
        tier: nearest.tier,
        rank: nearest.rank,
        leaguePoints: nearest.leaguePoints,
        normalizedLP: normalizeLP(nearest.tier, nearest.rank, nearest.leaguePoints),
      };
    }).filter(Boolean);

    res.json({ player, snapshots, matches, matchPoints });
  } catch (err) { next(err); }
}
