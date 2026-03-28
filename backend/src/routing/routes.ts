import type { Express } from 'express';
import { getHealth } from '@/controllers/healthController';
import { listPlayers, createPlayer, deletePlayer, getPlayer } from '@/controllers/playerController';
import { getLeaderboard } from '@/controllers/leaderboardController';
import { getSnapshots } from '@/controllers/snapshotController';
import { triggerCron } from '@/controllers/cronController';
import { getTournament, updateTournament } from '@/controllers/tournamentController';
import { lookupAccount } from '@/controllers/riotLookupController';
import {
  getNotificationFeed,
  ackNotificationFeed,
  getNotificationDailySummary,
  getNotificationDailyGraph,
} from '@/controllers/notificationController';

export function configureRoutes(app: Express): void {
  app.get('/api/health', getHealth);

  app.get('/api/leaderboard', getLeaderboard);

  app.get('/api/players', listPlayers);
  app.post('/api/players', createPlayer);
  app.delete('/api/players/:discordId', deletePlayer);
  app.get('/api/players/:discordId', getPlayer);

  app.get('/api/snapshots/:puuid', getSnapshots);

  app.get('/api/tournament/settings', getTournament);
  app.put('/api/tournament/settings', updateTournament);

  app.get('/api/riot/account/:gameName/:tagLine', lookupAccount);

  app.post('/api/cron/run', triggerCron);

  app.get('/api/notifications/feed', getNotificationFeed);
  app.post('/api/notifications/feed/ack', ackNotificationFeed);
  app.get('/api/notifications/daily-summary', getNotificationDailySummary);
  app.get('/api/notifications/daily-graph', getNotificationDailyGraph);
}
