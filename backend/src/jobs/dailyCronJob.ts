import cron from 'node-cron';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { MatchRecord } from '@/db/models/MatchRecord';
import { DailyPlayerScore } from '@/db/models/DailyPlayerScore';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers } from '@/services/playerService';
import { processEndOfPhase, processEndOfTournament } from '@/services/phaseService';
import { normalizeLP } from '@/lib/normalizeLP';
import { getDayBoundsUTC8, getTodayUTC8 } from '@/lib/dateUtils';
import { logger } from '@/lib/logger';
import { getPlayerLogLabel } from '@/lib/playerLogLabel';
import { runScheduledDataFetchJob } from '@/lib/scheduledDataFetch';

function getYesterdayUTC8(): string {
  const today = getTodayUTC8();
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function runDailyProcessing(day?: string): Promise<void> {
  const targetDay = day ?? getYesterdayUTC8();
  logger.info(`[daily-cron] Starting daily processing for ${targetDay}`);
  logger.debug({ targetDay }, '[daily-cron] Resolving settings and active players for daily processing');

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();
  const { dayStart, dayEnd } = getDayBoundsUTC8(targetDay);
  logger.debug({ playerCount: players.length, dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() }, '[daily-cron] Loaded active players and computed day bounds');

  // Determine current phase for this day
  const phase = settings.phases.find(
    (p) => targetDay >= p.startDay && targetDay <= p.endDay,
  );
  const phaseNum = phase?.phase ?? settings.currentPhase;
  logger.debug({ phaseNum, currentPhase: settings.currentPhase }, '[daily-cron] Phase resolved for target day');

  // Step 1: Compute daily LP gain and create DailyPlayerScore + match PointTransaction
  for (const player of players) {
    if (!player.godSlug) continue;

    try {
      const playerLabel = getPlayerLogLabel(player);
      const playerContext = {
        discordId: player.discordId,
        riotId: player.riotId ?? null,
        puuid: player.puuid,
      };
      logger.debug(playerContext, `[daily-cron] Computing daily score inputs for ${playerLabel}`);

      // Get first and last snapshot of the day
      const firstSnapshot = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ capturedAt: 1 });

      const lastSnapshot = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ capturedAt: -1 });

      const rawLpGain = (firstSnapshot && lastSnapshot)
        ? normalizeLP(lastSnapshot.tier, lastSnapshot.rank, lastSnapshot.leaguePoints) -
          normalizeLP(firstSnapshot.tier, firstSnapshot.rank, firstSnapshot.leaguePoints)
        : 0;
      logger.debug(
        { ...playerContext, hasFirstSnapshot: Boolean(firstSnapshot), hasLastSnapshot: Boolean(lastSnapshot), rawLpGain },
        `[daily-cron] Snapshot delta computed for ${playerLabel}`,
      );

      // Get matches played that day
      logger.debug(playerContext, `[daily-cron] Fetching daily match history for ${playerLabel}`);
      const matches = await MatchRecord.find({
        puuid: player.puuid,
        playedAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ playedAt: 1 });
      logger.debug({ ...playerContext, matchCount: matches.length }, `[daily-cron] Daily match history fetched for ${playerLabel}`);

      const placements = matches.map((m) => m.placement);

      // Upsert DailyPlayerScore
      await DailyPlayerScore.findOneAndUpdate(
        { playerId: player.discordId, day: targetDay },
        {
          playerId: player.discordId,
          puuid: player.puuid,
          godSlug: player.godSlug,
          day: targetDay,
          rawLpGain,
          matchCount: matches.length,
          placements,
        },
        { upsert: true, new: true },
      );
      logger.debug(
        { ...playerContext, targetDay, rawLpGain, matchCount: matches.length },
        `[daily-cron] Daily player score upserted for ${playerLabel}`,
      );

      // Match PointTransactions are now created in real-time by the 15-min cron (lp_delta).
    } catch (err) {
      logger.error(
        { err, discordId: player.discordId, riotId: player.riotId ?? null, puuid: player.puuid },
        `[daily-cron] Failed daily processing for ${getPlayerLogLabel(player)}`,
      );
    }
  }

  // Step 2: Check for end-of-phase
  if (phase && targetDay === phase.endDay) {
    try {
      logger.info(`[daily-cron] End of phase ${phase.phase} detected`);
      const eliminations = await processEndOfPhase(phase.phase);
      logger.info({ eliminations }, `[daily-cron] Phase ${phase.phase} eliminations complete`);
    } catch (err) {
      logger.error({ err }, `[daily-cron] Failed to process end of phase ${phase.phase}`);
    }
  }

  // Step 4: Check for end-of-tournament
  const lastPhase = settings.phases[settings.phases.length - 1];
  if (lastPhase && targetDay === lastPhase.endDay) {
    try {
      logger.info('[daily-cron] End of tournament detected');
      await processEndOfTournament();
    } catch (err) {
      logger.error({ err }, '[daily-cron] Failed to process end of tournament');
    }
  }

  logger.info(`[daily-cron] Daily processing complete for ${targetDay}`);
}

export function startDailyCronJob(): void {
  // Run at 16:00 UTC (midnight UTC+8)
  cron.schedule('0 16 * * *', () => {
    void runScheduledDataFetchJob('daily-cron', () => runDailyProcessing());
  });
  logger.info('[daily-cron] Daily processing job scheduled (0 16 * * *).');
}
