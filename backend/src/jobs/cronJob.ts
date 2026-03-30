import cron from 'node-cron';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { captureMatchesForPlayer } from '@/services/matchService';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers } from '@/services/playerService';
import { logger } from '@/lib/logger';
import type { PlayerDocument } from '@/types/Player';

const DEFAULT_PLAYER_CONCURRENCY = 4;

let isRunning = false;

function getPlayerProcessingConcurrency(): number {
  const parsed = Number.parseInt(process.env.CRON_PLAYER_CONCURRENCY ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_PLAYER_CONCURRENCY;
  }
  return parsed;
}

function hasCompetitiveStateChanged(
  before: Pick<PlayerDocument, 'currentTier' | 'currentRank' | 'currentLP' | 'currentWins' | 'currentLosses'>,
  after: Pick<PlayerDocument, 'currentTier' | 'currentRank' | 'currentLP' | 'currentWins' | 'currentLosses'>,
): boolean {
  return before.currentTier !== after.currentTier
    || before.currentRank !== after.currentRank
    || before.currentLP !== after.currentLP
    || before.currentWins !== after.currentWins
    || before.currentLosses !== after.currentLosses;
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  const workerLoop = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) return;
      await worker(items[currentIndex]);
    }
  };

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, workerLoop));
}

export async function runCronCycle(): Promise<void> {
  if (isRunning) {
    logger.warn('[cron] Previous cycle is still running. Skipping overlapping cycle.');
    return;
  }

  isRunning = true;

  try {
    const settings = await getTournamentSettings();
    const now = new Date();
    logger.debug({ now: now.toISOString(), startDate: settings.startDate.toISOString(), endDate: settings.endDate.toISOString() }, '[cron] Loaded tournament settings for cycle');

    if (now < settings.startDate) {
      logger.warn('[cron] Tournament has not started yet. Skipping cycle.');
      return;
    }
    if (now > settings.endDate) {
      logger.warn('[cron] Tournament has ended. Skipping cycle.');
      return;
    }

    logger.debug('[cron] Starting snapshot cycle...');
  logger.debug('[cron] Fetching active players...');
    const players = await listActivePlayers();
    const concurrency = getPlayerProcessingConcurrency();
    logger.debug(`[cron] Processing ${players.length} active players with concurrency ${concurrency}`);

    await runWithConcurrency(players, concurrency, async (player) => {
      logger.debug({ discordId: player.discordId, gameName: player.gameName }, `[cron] Processing player ${player.gameName}#${player.tagLine}`);
      try {
        const beforeState = {
          currentTier: player.currentTier,
          currentRank: player.currentRank,
          currentLP: player.currentLP,
          currentWins: player.currentWins,
          currentLosses: player.currentLosses,
        };
        logger.debug({ discordId: player.discordId, beforeState }, '[cron] Current player competitive state before refresh');

        logger.debug({ discordId: player.discordId }, '[cron] Fetching latest player ranked snapshot from Riot');
        const updatedPlayer = await captureSnapshotForPlayer(player);
        logger.debug({ discordId: player.discordId, currentTier: updatedPlayer.currentTier, currentRank: updatedPlayer.currentRank, currentLP: updatedPlayer.currentLP, currentWins: updatedPlayer.currentWins, currentLosses: updatedPlayer.currentLosses }, '[cron] Player snapshot refresh complete');

        logger.debug({ discordId: player.discordId }, '[cron] Fetching match history for player');
        await captureMatchesForPlayer(player);
        logger.debug({ discordId: player.discordId }, '[cron] Match history capture complete');

        const hasChanged = hasCompetitiveStateChanged(beforeState, {
          currentTier: updatedPlayer.currentTier,
          currentRank: updatedPlayer.currentRank,
          currentLP: updatedPlayer.currentLP,
          currentWins: updatedPlayer.currentWins,
          currentLosses: updatedPlayer.currentLosses,
        });

        if (!hasChanged) {
          logger.debug({ discordId: player.discordId }, '[cron] Skipping scoring (no competitive state change)');
        } else {
          logger.debug({ discordId: player.discordId }, '[cron] Competitive state changed, creating scoring delta transaction');
          await createLpDeltaTransaction(updatedPlayer, settings);
        }

        logger.debug({ discordId: player.discordId }, `[cron] Done processing ${player.gameName}#${player.tagLine}`);
      } catch (err) {
        logger.error({ err, discordId: player.discordId }, `[cron] Failed for player ${player.discordId}`);
      }
    });

    // Process buff points for any new matches
    try {
      logger.debug('[cron] Starting match buff processing');
      await processNewMatchBuffs();
      logger.debug('[cron] Match buff processing complete');
    } catch (err) {
      logger.error({ err }, '[cron] Failed to process match buffs');
    }

    logger.debug('[cron] Cycle complete.');
  } finally {
    isRunning = false;
  }
}

export function startCronJob(): void {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    void runCronCycle();
  });
  logger.debug('[cron] 15-minute snapshot job scheduled.');
}

