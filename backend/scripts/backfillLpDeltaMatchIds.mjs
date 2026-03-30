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

const DB_NAME = process.argv[2] ?? 'tft-tournament-testing';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
function dateToUTC8Str(date) {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

async function run() {
  await mongoose.connect(uri, { dbName: DB_NAME });
  const db = mongoose.connection.useDb(DB_NAME, { useCache: true }).db;

  const pointTx = db.collection('point_transactions');
  const players = db.collection('players');
  const matches = db.collection('match_records');

  const lpTx = await pointTx
    .find({ type: 'match', source: 'lp_delta', $or: [{ matchId: null }, { matchId: { $exists: false } }] })
    .sort({ playerId: 1, day: 1, createdAt: 1 })
    .toArray();

  if (lpTx.length === 0) {
    console.log('[backfill] No lp_delta transactions need updates.');
    return;
  }

  const playerIds = [...new Set(lpTx.map((tx) => tx.playerId))];
  const playerDocs = await players.find({ discordId: { $in: playerIds } }, { projection: { discordId: 1, puuid: 1 } }).toArray();
  const puuidByDiscord = new Map(playerDocs.map((p) => [p.discordId, p.puuid]));

  let updated = 0;

  for (const tx of lpTx) {
    const puuid = puuidByDiscord.get(tx.playerId);
    if (!puuid) continue;

    const linkedIds = await pointTx.distinct('matchId', {
      playerId: tx.playerId,
      type: 'match',
      source: 'lp_delta',
      matchId: { $ne: null },
    });

    const candidate = await matches.findOne(
      {
        puuid,
        matchId: { $nin: linkedIds },
      },
      { sort: { playedAt: 1 }, projection: { matchId: 1, playedAt: 1 } },
    );

    if (!candidate) continue;
    if (dateToUTC8Str(candidate.playedAt) !== tx.day) continue;

    const result = await pointTx.updateOne(
      { _id: tx._id, $or: [{ matchId: null }, { matchId: { $exists: false } }] },
      { $set: { matchId: candidate.matchId } },
    );

    if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  console.log(`[backfill] Updated ${updated}/${lpTx.length} lp_delta transactions with matchId.`);
}

run()
  .catch((err) => {
    console.error('[backfill] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
