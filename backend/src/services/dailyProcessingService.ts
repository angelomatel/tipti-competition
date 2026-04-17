import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { PHT_TIMEZONE } from '@/constants';
import { getCurrentPhtDay, getPhtDayBounds } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { normalizeLP } from '@/lib/normalizeLP';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { processEndOfPhase, processEndOfTournament } from '@/services/phaseService';
import { listActivePlayers } from '@/services/playerService';
import { getTournamentSettings } from '@/services/tournamentService';

function getYesterdayPhtDay(): string {
  const today = getCurrentPhtDay();
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export async function runDailyProcessing(day?: string): Promise<void> {
  const targetDay = day ?? getYesterdayPhtDay();
  logger.info(`[daily-cron] Starting daily processing for ${targetDay}`);
  logger.debug({ targetDay, timezone: PHT_TIMEZONE }, '[daily-cron] Resolving settings and active players for daily processing');

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();
  const godPlayers = players.filter((player): player is typeof players[number] & { godSlug: string } => Boolean(player.godSlug));
  const { dayStart, dayEnd } = getPhtDayBounds(targetDay);
  const phase = settings.phases.find((candidate) => targetDay >= candidate.startDay && targetDay <= candidate.endDay);
  const phaseNum = phase?.phase ?? settings.currentPhase;

  logger.debug(
    {
      playerCount: godPlayers.length,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
      phaseNum,
      currentPhase: settings.currentPhase,
    },
    '[daily-cron] Loaded active players and computed day bounds',
  );

  const playerData = await loadPlayerDayData(godPlayers.map((player) => player.puuid), dayStart, dayEnd);
  await upsertDailyScores(godPlayers, targetDay, playerData.firstSnapshotByPuuid, playerData.lastSnapshotByPuuid, playerData.matchesByPuuid);
  await processPhaseTransitions(targetDay, settings.phases, phase);

  logger.info(`[daily-cron] Daily processing complete for ${targetDay}`);
}

async function loadPlayerDayData(puuids: string[], dayStart: Date, dayEnd: Date) {
  const [snapshots, matches] = await Promise.all([
    LpSnapshot.find({
      puuid: { $in: puuids },
      capturedAt: { $gte: dayStart, $lte: dayEnd },
    })
      .sort({ puuid: 1, capturedAt: 1 })
      .lean(),
    MatchRecord.find({
      puuid: { $in: puuids },
      playedAt: { $gte: dayStart, $lte: dayEnd },
    })
      .sort({ puuid: 1, playedAt: 1 })
      .lean(),
  ]);

  return {
    firstSnapshotByPuuid: mapFirstSnapshots(snapshots),
    lastSnapshotByPuuid: mapLastSnapshots(snapshots),
    matchesByPuuid: groupMatchesByPuuid(matches),
  };
}

async function upsertDailyScores(
  players: Array<{ discordId: string; riotId?: string | null; puuid: string; godSlug: string }>,
  targetDay: string,
  firstSnapshotByPuuid: Map<string, { puuid: string; tier: string; rank: string; leaguePoints: number }>,
  lastSnapshotByPuuid: Map<string, { puuid: string; tier: string; rank: string; leaguePoints: number }>,
  matchesByPuuid: Map<string, Array<{ placement: number }>>,
): Promise<void> {
  const bulkOps = [];

  for (const player of players) {
    const playerLabel = getPlayerLogLabel({
      discordId: player.discordId,
      riotId: player.riotId ?? undefined,
    });
    const playerContext = {
      discordId: player.discordId,
      riotId: player.riotId ?? null,
      puuid: player.puuid,
    };

    logger.debug(playerContext, `[daily-cron] Computing daily score inputs for ${playerLabel}`);

    const firstSnapshot = firstSnapshotByPuuid.get(player.puuid);
    const lastSnapshot = lastSnapshotByPuuid.get(player.puuid);
    const rawLpGain = getRawLpGain(firstSnapshot, lastSnapshot);
    const playerMatches = matchesByPuuid.get(player.puuid) ?? [];
    const placements = playerMatches.map((match) => match.placement);

    logger.debug(
      {
        ...playerContext,
        hasFirstSnapshot: Boolean(firstSnapshot),
        hasLastSnapshot: Boolean(lastSnapshot),
        rawLpGain,
        matchCount: playerMatches.length,
      },
      `[daily-cron] Daily score inputs computed for ${playerLabel}`,
    );

    bulkOps.push({
      updateOne: {
        filter: { playerId: player.discordId, day: targetDay },
        update: {
          $set: {
            playerId: player.discordId,
            puuid: player.puuid,
            godSlug: player.godSlug,
            day: targetDay,
            rawLpGain,
            matchCount: playerMatches.length,
            placements,
          },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length > 0) {
    await DailyPlayerScore.bulkWrite(bulkOps, { ordered: false });
  }
}

async function processPhaseTransitions(
  targetDay: string,
  phases: Array<{ phase: number; startDay: string; endDay: string }>,
  currentPhaseForDay?: { phase: number; startDay: string; endDay: string },
): Promise<void> {
  if (currentPhaseForDay && targetDay === currentPhaseForDay.endDay) {
    try {
      logger.info(`[daily-cron] End of phase ${currentPhaseForDay.phase} detected`);
      const eliminations = await processEndOfPhase(currentPhaseForDay.phase);
      logger.info({ eliminations }, `[daily-cron] Phase ${currentPhaseForDay.phase} eliminations complete`);
    } catch (err) {
      logger.error({ err }, `[daily-cron] Failed to process end of phase ${currentPhaseForDay.phase}`);
    }
  }

  const lastPhase = phases[phases.length - 1];
  if (lastPhase && targetDay === lastPhase.endDay) {
    try {
      logger.info('[daily-cron] End of tournament detected');
      await processEndOfTournament();
    } catch (err) {
      logger.error({ err }, '[daily-cron] Failed to process end of tournament');
    }
  }
}

function mapFirstSnapshots<T extends { puuid: string }>(snapshots: T[]): Map<string, T> {
  const firstByPuuid = new Map<string, T>();

  for (const snapshot of snapshots) {
    if (!firstByPuuid.has(snapshot.puuid)) {
      firstByPuuid.set(snapshot.puuid, snapshot);
    }
  }

  return firstByPuuid;
}

function mapLastSnapshots<T extends { puuid: string }>(snapshots: T[]): Map<string, T> {
  const lastByPuuid = new Map<string, T>();

  for (const snapshot of snapshots) {
    lastByPuuid.set(snapshot.puuid, snapshot);
  }

  return lastByPuuid;
}

function groupMatchesByPuuid<T extends { puuid: string }>(matches: T[]): Map<string, T[]> {
  const matchesByPuuid = new Map<string, T[]>();

  for (const match of matches) {
    const playerMatches = matchesByPuuid.get(match.puuid) ?? [];
    playerMatches.push(match);
    matchesByPuuid.set(match.puuid, playerMatches);
  }

  return matchesByPuuid;
}

function getRawLpGain(
  firstSnapshot?: { tier: string; rank: string; leaguePoints: number },
  lastSnapshot?: { tier: string; rank: string; leaguePoints: number },
): number {
  if (!firstSnapshot || !lastSnapshot) return 0;

  return normalizeLP(lastSnapshot.tier, lastSnapshot.rank, lastSnapshot.leaguePoints)
    - normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints);
}
