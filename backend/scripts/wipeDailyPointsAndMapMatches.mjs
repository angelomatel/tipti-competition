import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('MONGODB_URI is not defined in backend/.env');
}

const DB_NAME = process.argv[2] ?? process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';
const FORCE_DESTRUCTIVE = process.argv.includes('--force') || process.env.ALLOW_DESTRUCTIVE_MAINTENANCE === 'true';

function assertSafeTargetDb(dbName) {
  const isSafe = /(test|testing|dev|local|sandbox)/i.test(dbName);
  if (!isSafe && !FORCE_DESTRUCTIVE) {
    throw new Error(
      `[safety] Refusing destructive run on DB "${dbName}". ` +
      'Use a test/dev DB name or pass --force (or ALLOW_DESTRUCTIVE_MAINTENANCE=true).',
    );
  }
}

const DAILY_LP_SOURCES = ['lp_delta', 'lp_data', 'daily_lp_gain'];

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
function dateToUTC8Str(date) {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

async function run() {
  assertSafeTargetDb(DB_NAME);

  await mongoose.connect(uri, { dbName: DB_NAME });
  const db = mongoose.connection.useDb(DB_NAME, { useCache: true }).db;

  const pointTx = db.collection('point_transactions');
  const players = db.collection('players');
  const matches = db.collection('match_records');

  const wipeFilter = {
    type: 'match',
    source: { $in: DAILY_LP_SOURCES },
  };

  const beforeCount = await pointTx.countDocuments(wipeFilter);
  const wipeResult = await pointTx.deleteMany(wipeFilter);

  const candidates = await pointTx
    .find({
      type: 'match',
      matchId: { $in: [null, undefined] },
    })
    .sort({ playerId: 1, day: 1, createdAt: 1 })
    .toArray();

  if (candidates.length === 0) {
    console.log(`[maintenance] Wiped ${wipeResult.deletedCount}/${beforeCount} daily LP transactions.`);
    console.log('[maintenance] No remaining unmapped match-type transactions found.');
    return;
  }

  const playerIds = [...new Set(candidates.map((tx) => tx.playerId))];
  const playerDocs = await players
    .find({ discordId: { $in: playerIds } }, { projection: { discordId: 1, puuid: 1 } })
    .toArray();
  const puuidByDiscord = new Map(playerDocs.map((p) => [p.discordId, p.puuid]));

  let updated = 0;

  for (const tx of candidates) {
    const puuid = puuidByDiscord.get(tx.playerId);
    if (!puuid) continue;

    const linkedIds = await pointTx.distinct('matchId', {
      playerId: tx.playerId,
      type: 'match',
      matchId: { $nin: [null, undefined] },
    });

    const day = tx.day ?? (tx.createdAt ? dateToUTC8Str(new Date(tx.createdAt)) : null);
    if (!day) continue;

    const dayStart = new Date(new Date(`${day}T00:00:00.000Z`).getTime() - UTC8_OFFSET_MS);
    const dayEnd = new Date(new Date(`${day}T23:59:59.999Z`).getTime() - UTC8_OFFSET_MS);

    const candidateMatch = await matches.findOne(
      {
        puuid,
        playedAt: { $gte: dayStart, $lte: dayEnd },
        matchId: { $nin: linkedIds },
      },
      { sort: { playedAt: 1 }, projection: { matchId: 1 } },
    );

    if (!candidateMatch) continue;

    const result = await pointTx.updateOne(
      { _id: tx._id, matchId: { $in: [null, undefined] } },
      { $set: { matchId: candidateMatch.matchId } },
    );

    if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`[maintenance] Wiped ${wipeResult.deletedCount}/${beforeCount} daily LP transactions.`);
  console.log(`[maintenance] Mapped ${updated}/${candidates.length} remaining match-type transactions.`);
}

run()
  .catch((err) => {
    console.error('[maintenance] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
