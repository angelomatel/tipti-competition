import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';
const FORCE_DESTRUCTIVE = process.argv.includes('--force') || process.env.ALLOW_DESTRUCTIVE_MAINTENANCE === 'true';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in backend/.env');
}
const MONGODB_URI_SAFE = MONGODB_URI;

function assertSafeTargetDb(dbName: string): void {
  const isSafe = /(test|testing|dev|local|sandbox)/i.test(dbName);
  if (!isSafe && !FORCE_DESTRUCTIVE) {
    throw new Error(
      `[safety] Refusing destructive run on DB "${dbName}". ` +
      'Use a test/dev DB name or pass --force (or ALLOW_DESTRUCTIVE_MAINTENANCE=true).',
    );
  }
}

function dateToUTC8Str(date: Date): string {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

async function backfillLpDeltaMatchIds(): Promise<{ pending: number; mapped: number }> {
  const { PointTransaction } = await import('@/db/models/PointTransaction');
  const { MatchRecord } = await import('@/db/models/MatchRecord');
  const { Player } = await import('@/db/models/Player');

  const pending = await PointTransaction.find({
    type: 'match',
    source: 'lp_delta',
    matchId: null,
  }).sort({ playerId: 1, day: 1, createdAt: 1 });

  let mapped = 0;

  for (const tx of pending) {
    const player = await Player.findOne({ discordId: tx.playerId }).lean();
    if (!player?.puuid) continue;

    const linkedMatchIds = await PointTransaction.distinct('matchId', {
      playerId: tx.playerId,
      type: 'match',
      source: 'lp_delta',
      matchId: { $ne: null },
    });

    const allUnlinkedMatches = await MatchRecord.find({
      puuid: player.puuid,
      matchId: { $nin: linkedMatchIds },
    }).sort({ playedAt: 1 }).lean();

    if (allUnlinkedMatches.length === 0) continue;

  const sameDay = allUnlinkedMatches.find((m: any) => dateToUTC8Str(m.playedAt) === tx.day);
    const selected = sameDay ?? allUnlinkedMatches[0];

    const result = await PointTransaction.updateOne(
      { _id: tx._id, matchId: null },
      { $set: { matchId: selected.matchId } },
    );

    if (result.modifiedCount > 0) {
      mapped += 1;
    }
  }

  return { pending: pending.length, mapped };
}

async function run(): Promise<void> {
  assertSafeTargetDb(DB_NAME);

  const { PointTransaction } = await import('@/db/models/PointTransaction');
  const { listActivePlayers } = await import('@/services/playerService');
  const { getTournamentSettings } = await import('@/services/tournamentService');
  const { createLpDeltaTransaction } = await import('@/services/scoringEngine');

  await mongoose.connect(MONGODB_URI_SAFE, { dbName: DB_NAME });

  const wipeResult = await PointTransaction.deleteMany({
    type: { $in: ['buff', 'match'] },
  });

  const settings = await getTournamentSettings();
  const players = await listActivePlayers();

  let reseeded = 0;
  for (const player of players) {
    try {
      const before = await PointTransaction.countDocuments({
        playerId: player.discordId,
        type: 'match',
        source: 'lp_delta',
      });

      await createLpDeltaTransaction(player, settings);

      const after = await PointTransaction.countDocuments({
        playerId: player.discordId,
        type: 'match',
        source: 'lp_delta',
      });

      if (after > before) reseeded += 1;
    } catch {
      // Continue best-effort for maintenance script
    }
  }

  const backfill = await backfillLpDeltaMatchIds();

  const finalCounts = {
    matchLpDelta: await PointTransaction.countDocuments({ type: 'match', source: 'lp_delta' }),
    mappedMatchLpDelta: await PointTransaction.countDocuments({ type: 'match', source: 'lp_delta', matchId: { $ne: null } }),
    buffs: await PointTransaction.countDocuments({ type: 'buff' }),
    penalties: await PointTransaction.countDocuments({ type: 'penalty' }),
    godPlacementBonus: await PointTransaction.countDocuments({ type: 'god_placement_bonus' }),
  };

  console.log(JSON.stringify({
    db: mongoose.connection.db?.databaseName,
    wiped: wipeResult.deletedCount,
    playersProcessed: players.length,
    playersReseeded: reseeded,
    backfill,
    finalCounts,
  }, null, 2));
}

run()
  .catch((err) => {
    console.error('[reset-reseed] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
