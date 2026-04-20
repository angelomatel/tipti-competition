import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in backend/.env');
}

interface DuplicateGroup {
  _id: { playerId: string; matchId: string; source: string; godSlug: string };
  count: number;
  totalValue: number;
  txns: Array<{ _id: unknown; value: number; createdAt: Date; day: string; phase: number }>;
}

interface GodMismatchRow {
  _id: unknown;
  playerId: string;
  matchId: string;
  source: string;
  godSlug: string;
  value: number;
  day: string;
  createdAt: Date;
}

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI!, { dbName: DB_NAME });
  console.log(`[audit] Connected to ${DB_NAME}`);

  const { PointTransaction } = await import('@/db/models/PointTransaction');
  const { Player } = await import('@/db/models/Player');

  const duplicates = await PointTransaction.aggregate<DuplicateGroup>([
    { $match: { type: 'buff', matchId: { $type: 'string' } } },
    {
      $group: {
        _id: { playerId: '$playerId', matchId: '$matchId', source: '$source', godSlug: '$godSlug' },
        count: { $sum: 1 },
        totalValue: { $sum: '$value' },
        txns: { $push: { _id: '$_id', value: '$value', createdAt: '$createdAt', day: '$day', phase: '$phase' } },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
  ]);

  console.log(`[audit] Duplicate buff groups found: ${duplicates.length}`);

  const countByGod = new Map<string, number>();
  const countBySource = new Map<string, number>();
  for (const group of duplicates) {
    countByGod.set(group._id.godSlug, (countByGod.get(group._id.godSlug) ?? 0) + 1);
    countBySource.set(group._id.source, (countBySource.get(group._id.source) ?? 0) + 1);
  }
  console.log('[audit] Duplicates per god:', Object.fromEntries(countByGod));
  console.log('[audit] Duplicates per source:', Object.fromEntries(countBySource));

  const playerIds = [...new Set(duplicates.map((group) => group._id.playerId))];
  const players = await Player.find({ discordId: { $in: playerIds } })
    .select({ discordId: 1, gameName: 1, tagLine: 1, godSlug: 1 })
    .lean();
  const playerByDiscordId = new Map(players.map((player) => [player.discordId, player]));

  for (const group of duplicates.slice(0, 50)) {
    const player = playerByDiscordId.get(group._id.playerId);
    const label = player ? `${player.gameName}#${player.tagLine}` : group._id.playerId;
    console.log(
      `- ${label} | match=${group._id.matchId} | god=${group._id.godSlug} | source=${group._id.source} | count=${group.count} | total=${group.totalValue}`,
    );
    for (const txn of group.txns) {
      console.log(`    ↳ _id=${String(txn._id)} value=${txn.value} day=${txn.day} phase=${txn.phase} createdAt=${txn.createdAt.toISOString()}`);
    }
  }
  if (duplicates.length > 50) {
    console.log(`[audit] ... ${duplicates.length - 50} more groups omitted from per-row dump`);
  }

  const kohaneMatch = 'SG2_147776854';
  const kohaneTxns = await PointTransaction.find({ matchId: kohaneMatch, type: 'buff' }).lean();
  console.log(`[audit] Transactions for match ${kohaneMatch}: ${kohaneTxns.length}`);
  for (const txn of kohaneTxns) {
    const player = playerByDiscordId.get(txn.playerId) ?? null;
    const label = player ? `${player.gameName}#${player.tagLine}` : txn.playerId;
    console.log(
      `  - ${label} god=${txn.godSlug} source=${txn.source} value=${txn.value} day=${txn.day} createdAt=${txn.createdAt?.toISOString?.() ?? txn.createdAt}`,
    );
  }

  const mismatched: GodMismatchRow[] = [];
  const allBuffPlayerIds = await PointTransaction.distinct('playerId', { type: 'buff' });
  const allPlayers = await Player.find({ discordId: { $in: allBuffPlayerIds } })
    .select({ discordId: 1, gameName: 1, tagLine: 1, godSlug: 1 })
    .lean();
  const allPlayerByDiscordId = new Map(allPlayers.map((player) => [player.discordId, player]));

  const buffTxns = await PointTransaction.find({ type: 'buff' })
    .select({ playerId: 1, matchId: 1, source: 1, godSlug: 1, value: 1, day: 1, createdAt: 1 })
    .lean();
  for (const txn of buffTxns) {
    const player = allPlayerByDiscordId.get(txn.playerId);
    if (!player || !player.godSlug) continue;
    if (player.godSlug !== txn.godSlug) {
      mismatched.push({
        _id: txn._id,
        playerId: txn.playerId,
        matchId: txn.matchId ?? '',
        source: txn.source,
        godSlug: txn.godSlug,
        value: txn.value,
        day: txn.day,
        createdAt: txn.createdAt as Date,
      });
    }
  }

  console.log(`[audit] Buff txns whose godSlug differs from player.godSlug: ${mismatched.length}`);
  for (const row of mismatched.slice(0, 50)) {
    const player = allPlayerByDiscordId.get(row.playerId);
    const label = player ? `${player.gameName}#${player.tagLine}` : row.playerId;
    console.log(
      `  - ${label} match=${row.matchId} txnGod=${row.godSlug} playerGod=${player?.godSlug} source=${row.source} value=${row.value} day=${row.day}`,
    );
  }

  const report = {
    duplicateGroupCount: duplicates.length,
    duplicatesPerGod: Object.fromEntries(countByGod),
    duplicatesPerSource: Object.fromEntries(countBySource),
    kohaneMatchTxnCount: kohaneTxns.length,
    godMismatchCount: mismatched.length,
  };
  console.log('[audit] JSON_REPORT ' + JSON.stringify(report));

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[audit] Failed:', error);
  process.exit(1);
});
