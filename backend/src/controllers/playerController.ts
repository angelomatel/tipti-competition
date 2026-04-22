import type { Request, Response, NextFunction } from 'express';
import { performance } from 'node:perf_hooks';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { God } from '@/db/models/God';
import { PlayerPollState } from '@/db/models/PlayerPollState';
import { normalizeLP } from '@/lib/normalizeLP';
import { QUERY_LIMITS } from '@/constants';
import {
  registerPlayer,
  removePlayer,
  listActivePlayers,
  getPlayerByDiscordId,
  updatePlayerProfile,
} from '@/services/playerService';
import { getTournamentSettings } from '@/services/tournamentService';
import { computePlayerScoreBreakdown, computePlayerDailyBreakdown } from '@/services/scoringEngine';
import { logger } from '@/lib/logger';

async function measureAsyncStep<T>(
  timings: Record<string, number>,
  step: string,
  action: () => Promise<T> | PromiseLike<T> | T,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await action();
  } finally {
    timings[step] = Math.round((performance.now() - startedAt) * 100) / 100;
  }
}

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
    if (err.message?.includes('Registration is closed')) {
      res.status(403).json({ error: err.message });
      return;
    }
    if (
      err.message?.includes('not accepting subjects at this moment')
      || err.message?.includes('no longer available for registration')
    ) {
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

export async function patchPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const discordId = req.params['discordId'] as string;
    const { discordAvatarUrl, discordUsername } = req.body;
    await updatePlayerProfile(discordId, { discordAvatarUrl, discordUsername });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function getPlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const discordId = req.params['discordId'] as string;
    const timings: Record<string, number> = {};
    const requestStartedAt = performance.now();

    const player = await measureAsyncStep(timings, 'playerLookupMs', () => getPlayerByDiscordId(discordId));
    if (!player) { res.status(404).json({ error: 'Player not found.' }); return; }

    const rawMatchLimit = Number.parseInt(String(req.query['matchLimit'] ?? ''), 10);
    const matchLimit = Number.isFinite(rawMatchLimit) && rawMatchLimit >= 0
      ? Math.min(rawMatchLimit, QUERY_LIMITS.MATCHES_MAX)
      : QUERY_LIMITS.MATCHES;

    const [
      rawSnapshots,
      rawMatches,
      god,
      scoreBreakdown,
      dailyPoints,
      settings,
      pollState,
    ] = await Promise.all([
      measureAsyncStep(timings, 'snapshotsQueryMs', () => LpSnapshot.find({ puuid: player.puuid })
        .sort({ capturedAt: -1 })
        .limit(QUERY_LIMITS.SNAPSHOTS)
        .lean()),
      measureAsyncStep(timings, 'matchesQueryMs', () => {
        const q = MatchRecord.find({ puuid: player.puuid }).sort({ playedAt: -1 });
        return (matchLimit > 0 ? q.limit(matchLimit) : q).lean();
      }),
      measureAsyncStep(timings, 'godQueryMs', () => (player.godSlug ? God.findOne({ slug: player.godSlug }).lean() : Promise.resolve(null))),
      measureAsyncStep(timings, 'scoreBreakdownMs', () => computePlayerScoreBreakdown(player.discordId)),
      measureAsyncStep(timings, 'dailyBreakdownMs', () => computePlayerDailyBreakdown(player.discordId)),
      measureAsyncStep(timings, 'settingsQueryMs', () => getTournamentSettings()),
      measureAsyncStep(timings, 'pollStateQueryMs', () => PlayerPollState.findOne({ playerId: player.discordId }).lean()),
    ]);

    rawSnapshots.reverse();

    const snapshots = rawSnapshots.map((s) => ({
      capturedAt: s.capturedAt,
      tier: s.tier,
      rank: s.rank,
      leaguePoints: s.leaguePoints,
      normalizedLP: normalizeLP(s.tier, s.rank, s.leaguePoints),
      wins: s.wins,
      losses: s.losses,
    }));

    rawMatches.reverse();

    const matches = rawMatches.map((m) => ({
      matchId: m.matchId,
      placement: m.placement,
      playedAt: m.playedAt,
      lpStatus: m.lpAttributionStatus === 'ambiguous'
        ? 'unknown'
        : m.lpAttributionStatus === 'pending'
          ? 'resolving'
          : 'none',
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

    const hideGods = new Date() < settings.startDate;
    timings.totalMs = Math.round((performance.now() - requestStartedAt) * 100) / 100;

    logger.debug(
      {
        discordId,
        matchLimit,
        timings,
        counts: {
          snapshots: snapshots.length,
          matches: matches.length,
          matchPoints: matchPoints.length,
          dailyPointDays: dailyPoints.length,
        },
      },
      '[player] Profile query timings',
    );

    res.json({
      player,
      snapshots,
      matches,
      matchPoints,
      godSlug: hideGods ? null : player.godSlug,
      godName: hideGods ? 'Hidden' : (god?.name ?? null),
      godTitle: hideGods ? null : (god?.title ?? null),
      scorePoints: scoreBreakdown.total,
      pointBreakdown: scoreBreakdown,
      dailyPoints,
      pollState: pollState ? {
        lastRankPollAt: pollState.lastRankPollAt,
        lastMatchPollAt: pollState.lastMatchPollAt,
      } : null,
    });
  } catch (err) { next(err); }
}
