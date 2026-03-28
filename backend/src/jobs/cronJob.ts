import cron from 'node-cron';
import { Player } from '@/db/models/Player';
import { captureSnapshotForPlayer } from '@/services/snapshotService';
import { captureMatchesForPlayer } from '@/services/matchService';
import { getTournamentSettings } from '@/services/tournamentService';
import { logger } from '@/lib/logger';

export async function runCronCycle(): Promise<void> {
  const settings = await getTournamentSettings();
  const now = new Date();

  if (now < settings.startDate) {
    logger.info('[cron] Tournament has not started yet. Skipping cycle.');
    return;
  }
  if (now > settings.endDate) {
    logger.info('[cron] Tournament has ended. Skipping cycle.');
    return;
  }

  logger.info('[cron] Starting snapshot cycle...');
  const players = await Player.find({ isActive: true });
  logger.info(`[cron] Processing ${players.length} active players`);

  for (const player of players) {
    logger.debug({ discordId: player.discordId, gameName: player.gameName }, `[cron] Processing player ${player.gameName}#${player.tagLine}`);
    try {
      await captureSnapshotForPlayer(player);
      await captureMatchesForPlayer(player);
      logger.debug({ discordId: player.discordId }, `[cron] Done processing ${player.gameName}#${player.tagLine}`);
    } catch (err) {
      logger.error({ err, discordId: player.discordId }, `[cron] Failed for player ${player.discordId}`);
    }
  }

  logger.info('[cron] Cycle complete.');
}

export function startCronJob(): void {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    void runCronCycle();
  });
  logger.info('[cron] 15-minute snapshot job scheduled.');
}

