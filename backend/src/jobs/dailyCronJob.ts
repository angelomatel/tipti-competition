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

function getYesterdayUTC8(): string {
  const today = getTodayUTC8();
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function runDailyProcessing(day?: string): Promise<void> {
  const targetDay = day ?? getYesterdayUTC8();
  logger.info(`[daily-cron] Starting daily processing for ${targetDay}`);

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();
  const { dayStart, dayEnd } = getDayBoundsUTC8(targetDay);

  // Determine current phase for this day
  const phase = settings.phases.find(
    (p) => targetDay >= p.startDay && targetDay <= p.endDay,
  );
  const phaseNum = phase?.phase ?? settings.currentPhase;

  // Step 1: Compute daily LP gain and create DailyPlayerScore + match PointTransaction
  for (const player of players) {
    if (!player.godSlug) continue;

    try {
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

      // Get matches played that day
      const matches = await MatchRecord.find({
        puuid: player.puuid,
        playedAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ playedAt: 1 });

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

      // Match PointTransactions are now created in real-time by the 15-min cron (lp_delta).
    } catch (err) {
      logger.error({ err, discordId: player.discordId }, `[daily-cron] Failed for ${player.discordId}`);
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
    void runDailyProcessing();
  });
  logger.info('[daily-cron] Daily processing job scheduled (0 16 * * *).');
}
