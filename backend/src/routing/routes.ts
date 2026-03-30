import type { Express } from 'express';
import { getHealth } from '@/controllers/healthController';
import { listPlayers, createPlayer, deletePlayer, patchPlayer, getPlayer } from '@/controllers/playerController';
import { getLeaderboard } from '@/controllers/leaderboardController';
import { getSnapshots } from '@/controllers/snapshotController';
import { triggerCron, triggerDailyCron } from '@/controllers/cronController';
import { getTournament, updateTournament } from '@/controllers/tournamentController';
import { lookupAccount } from '@/controllers/riotLookupController';
import {
  getNotificationFeed,
  ackNotificationFeed,
  getNotificationDailySummary,
  getNotificationDailyGraph,
} from '@/controllers/notificationController';
import {
  listGods,
  getGod,
  seedGods,
  assignGod,
  eliminateGodHandler,
  getGodStandings,
} from '@/controllers/godController';
import { getPlayerPoints, getPlayerDailyPoints } from '@/controllers/pointsController';
import { wipePlayerData } from '@/controllers/adminController';

export function configureRoutes(app: Express): void {
  app.get('/api/health', getHealth);

  app.get('/api/leaderboard', getLeaderboard);

  app.get('/api/players', listPlayers);
  app.post('/api/players', createPlayer);
  app.delete('/api/players/:discordId', deletePlayer);
  app.patch('/api/players/:discordId', patchPlayer);
  app.get('/api/players/:discordId', getPlayer);

  app.get('/api/snapshots/:puuid', getSnapshots);

  app.get('/api/tournament/settings', getTournament);
  app.put('/api/tournament/settings', updateTournament);

  app.get('/api/riot/account/:gameName/:tagLine', lookupAccount);

  app.post('/api/cron/run', triggerCron);
  app.get('/api/cron/run', triggerCron);
  app.post('/api/cron/run-daily', triggerDailyCron);
  app.get('/api/cron/run-daily', triggerDailyCron);

  // God system
  app.get('/api/gods', listGods);
  app.get('/api/gods/standings', getGodStandings);
  app.post('/api/gods/seed', seedGods);
  app.get('/api/gods/:slug', getGod);
  app.post('/api/gods/:slug/assign', assignGod);
  app.post('/api/gods/:slug/eliminate', eliminateGodHandler);

  // Points
  app.get('/api/points/:discordId', getPlayerPoints);
  app.get('/api/points/:discordId/daily', getPlayerDailyPoints);

  // Admin
  app.post('/api/admin/wipe-data', wipePlayerData);

  // Notifications
  app.get('/api/notifications/feed', getNotificationFeed);
  app.post('/api/notifications/feed/ack', ackNotificationFeed);
  app.get('/api/notifications/daily-summary', getNotificationDailySummary);
  app.get('/api/notifications/daily-graph', getNotificationDailyGraph);
}
