import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';
const FORCE_DESTRUCTIVE = process.argv.includes('--force') || process.env.ALLOW_DESTRUCTIVE_MAINTENANCE === 'true';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in backend/.env');
}

function assertSafeTargetDb(dbName: string): void {
  const isSafe = /(test|testing|dev|local|sandbox)/i.test(dbName);
  if (!isSafe && !FORCE_DESTRUCTIVE) {
    throw new Error(
      `[safety] Refusing destructive run on DB "${dbName}". ` +
      'Use a test/dev DB name or pass --force (or ALLOW_DESTRUCTIVE_MAINTENANCE=true).',
    );
  }
}

async function run(): Promise<void> {
  assertSafeTargetDb(DB_NAME);

  const { connectDB } = await import('@/db/connection');
  const { listActivePlayers } = await import('@/services/playerService');
  const { getTournamentSettings } = await import('@/services/tournamentService');
  const { captureSnapshotForPlayer } = await import('@/services/snapshotService');
  const { captureMatchesForPlayer } = await import('@/services/matchService');
  const { createLpDeltaTransaction } = await import('@/services/scoringEngine');

  await connectDB();

  const db = mongoose.connection.useDb(DB_NAME, { useCache: true }).db;
  if (!db) {
    throw new Error('Failed to obtain MongoDB database handle.');
  }

  // Keep players; wipe derived data only.
  const wipeResults = {
    lpSnapshots: (await db.collection('lp_snapshots').deleteMany({})).deletedCount,
    matchRecords: (await db.collection('match_records').deleteMany({})).deletedCount,
    dailyPlayerScores: (await db.collection('daily_player_scores').deleteMany({})).deletedCount,
    pointTransactions: (await db.collection('point_transactions').deleteMany({})).deletedCount,
  };

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();

  let snapshotRefreshed = 0;
  let matchRefreshed = 0;
  let lpDeltaCreated = 0;

  for (const player of players) {
    try {
      const updated = await captureSnapshotForPlayer(player);
      snapshotRefreshed += 1;

      const beforeMatches = await db.collection('match_records').countDocuments({ puuid: updated.puuid });
      await captureMatchesForPlayer(updated);
      const afterMatches = await db.collection('match_records').countDocuments({ puuid: updated.puuid });
      if (afterMatches > beforeMatches) {
        matchRefreshed += 1;
      }

      const beforeLpDelta = await db.collection('point_transactions').countDocuments({
        playerId: updated.discordId,
        type: 'match',
        source: 'lp_delta',
      });

      // Intentionally no backfilling here; this tests direct lp_delta creation behavior.
      await createLpDeltaTransaction(updated, settings);

      const afterLpDelta = await db.collection('point_transactions').countDocuments({
        playerId: updated.discordId,
        type: 'match',
        source: 'lp_delta',
      });

      if (afterLpDelta > beforeLpDelta) {
        lpDeltaCreated += 1;
      }
    } catch {
      // Continue best-effort for this maintenance script.
    }
  }

  const summary = {
    db: DB_NAME,
    playersKept: await db.collection('players').countDocuments({}),
    activePlayersProcessed: players.length,
    wipeResults,
    refreshResults: {
      snapshotRefreshed,
      playersWithNewMatches: matchRefreshed,
      playersWithNewLpDelta: lpDeltaCreated,
    },
    lpDeltaCounts: {
      total: await db.collection('point_transactions').countDocuments({ type: 'match', source: 'lp_delta' }),
      mapped: await db.collection('point_transactions').countDocuments({ type: 'match', source: 'lp_delta', matchId: { $ne: null } }),
      unmapped: await db.collection('point_transactions').countDocuments({ type: 'match', source: 'lp_delta', matchId: null }),
    },
    finalCounts: {
      snapshots: await db.collection('lp_snapshots').countDocuments({}),
      matches: await db.collection('match_records').countDocuments({}),
      pointTransactions: await db.collection('point_transactions').countDocuments({}),
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

run()
  .catch((err) => {
    console.error('[wipe-refetch] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
