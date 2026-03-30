import cron from 'node-cron';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { captureMatchesForPlayer } from '@/services/matchService';
import { createLpDeltaTransaction } from '@/services/scoringEngine';
import { processNewMatchBuffs } from '@/services/matchBuffProcessor';
import { getTournamentSettings } from '@/services/tournamentService';
import { listActivePlayers } from '@/services/playerService';
import { Player } from '@/db/models/Player';
import { logger } from '@/lib/logger';

export async function runCronCycle(): Promise<void> {
  const settings = await getTournamentSettings();
  const now = new Date();

  if (now < settings.startDate) {
    logger.warn('[cron] Tournament has not started yet. Skipping cycle.');
    return;
  }
  if (now > settings.endDate) {
    logger.warn('[cron] Tournament has ended. Skipping cycle.');
    return;
  }

  logger.debug('[cron] Starting snapshot cycle...');
  const players = await listActivePlayers();
  logger.debug(`[cron] Processing ${players.length} active players`);

  for (const player of players) {
    logger.debug({ discordId: player.discordId, gameName: player.gameName }, `[cron] Processing player ${player.gameName}#${player.tagLine}`);
    try {
      await captureSnapshotForPlayer(player);
      await captureMatchesForPlayer(player);

      // Re-fetch player to get updated LP after snapshot capture
      const updatedPlayer = await Player.findOne({ discordId: player.discordId });
      if (updatedPlayer) {
        await createLpDeltaTransaction(updatedPlayer, settings);
      }

      logger.debug({ discordId: player.discordId }, `[cron] Done processing ${player.gameName}#${player.tagLine}`);
    } catch (err) {
      logger.error({ err, discordId: player.discordId }, `[cron] Failed for player ${player.discordId}`);
    }
  }

  // Process buff points for any new matches
  try {
    await processNewMatchBuffs();
  } catch (err) {
    logger.error({ err }, '[cron] Failed to process match buffs');
  }

  logger.debug('[cron] Cycle complete.');
}

export function startCronJob(): void {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    void runCronCycle();
  });
  logger.debug('[cron] 15-minute snapshot job scheduled.');
}

