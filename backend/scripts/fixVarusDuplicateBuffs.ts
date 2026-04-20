import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';
const APPLY = process.argv.includes('--apply');

if (!MONGODB_URI) throw new Error('MONGODB_URI not set');

const DUP_IDS: Record<string, { flat: string; top10: string }> = {
  '222326550488547328': {
    flat: '69e50b478d7b421102e77aa9',
    top10: '69e50b478d7b421102e77aaa',
  },
  '429175022335295488': {
    flat: '69e50b478d7b421102e77aab',
    top10: '69e50b478d7b421102e77aac',
  },
};

const REATTRIBUTIONS: Array<{
  playerId: string;
  targetMatchId: string;
  expectedPuuidHint: string;
}> = [
  { playerId: '222326550488547328', targetMatchId: 'SG2_147829371', expectedPuuidHint: 'Nanande' },
  { playerId: '429175022335295488', targetMatchId: 'SG2_147790687', expectedPuuidHint: 'Kohane' },
];

const DAY = '2026-04-20';
const PHASE = 2;
const GOD = 'varus';
const FLAT_VALUE = 7;
const TOP10_VALUE = 8;

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI!, { dbName: DB_NAME });
  console.log(`[fix] Connected to ${DB_NAME} (mode: ${APPLY ? 'APPLY' : 'DRY-RUN'})`);

  const { PointTransaction } = await import('@/db/models/PointTransaction');
  const { MatchRecord } = await import('@/db/models/MatchRecord');
  const { Player } = await import('@/db/models/Player');

  // Preflight: verify every duplicate _id still exists with the expected shape.
  for (const [playerId, ids] of Object.entries(DUP_IDS)) {
    for (const [label, _id] of [['flat', ids.flat], ['top10', ids.top10]] as const) {
      const doc = await PointTransaction.findById(new mongoose.Types.ObjectId(_id)).lean();
      if (!doc) throw new Error(`[fix] Missing duplicate doc ${_id} (${playerId}/${label})`);
      if (doc.playerId !== playerId) throw new Error(`[fix] Doc ${_id} playerId mismatch: ${doc.playerId} != ${playerId}`);
      if (doc.type !== 'buff') throw new Error(`[fix] Doc ${_id} is not type=buff (${doc.type})`);
      if (doc.godSlug !== GOD) throw new Error(`[fix] Doc ${_id} godSlug mismatch: ${doc.godSlug} != ${GOD}`);
      if (doc.matchId !== 'SG2_147776854') throw new Error(`[fix] Doc ${_id} matchId mismatch: ${doc.matchId}`);
      const expectedSource = label === 'flat' ? 'varus_flat' : 'varus_top10';
      if (doc.source !== expectedSource) throw new Error(`[fix] Doc ${_id} source mismatch: ${doc.source} != ${expectedSource}`);
      const expectedValue = label === 'flat' ? FLAT_VALUE : TOP10_VALUE;
      if (doc.value !== expectedValue) throw new Error(`[fix] Doc ${_id} value mismatch: ${doc.value} != ${expectedValue}`);
      console.log(`[fix] ✓ duplicate verified: _id=${_id} player=${playerId} ${expectedSource}=${expectedValue}`);
    }
  }

  // Preflight: verify each (playerId, matchId, source) pair currently has exactly 2 docs.
  for (const playerId of Object.keys(DUP_IDS)) {
    for (const source of ['varus_flat', 'varus_top10']) {
      const count = await PointTransaction.countDocuments({
        playerId,
        matchId: 'SG2_147776854',
        source,
        type: 'buff',
      });
      if (count !== 2) throw new Error(`[fix] Expected 2 ${source} docs for ${playerId} on SG2_147776854, found ${count}`);
    }
  }

  // Preflight: reattribution targets exist, owned by expected player, buffProcessed, no existing buff txns for this player.
  for (const row of REATTRIBUTIONS) {
    const player = await Player.findOne({ discordId: row.playerId }).lean();
    if (!player) throw new Error(`[fix] Player not found: ${row.playerId}`);
    const match = await MatchRecord.findOne({ matchId: row.targetMatchId, puuid: player.puuid }).lean();
    if (!match) throw new Error(`[fix] Match ${row.targetMatchId} not found for puuid ${player.puuid}`);
    if (match.buffProcessed !== true) throw new Error(`[fix] Match ${row.targetMatchId} not buffProcessed`);
    const existingBuffs = await PointTransaction.countDocuments({
      playerId: row.playerId,
      matchId: row.targetMatchId,
      type: 'buff',
    });
    if (existingBuffs !== 0) throw new Error(`[fix] Target match ${row.targetMatchId} already has ${existingBuffs} buff txns for ${row.playerId}`);
    console.log(`[fix] ✓ reattribution target verified: ${row.expectedPuuidHint} → ${row.targetMatchId} (placement=${match.placement}, currently 0 buff txns)`);
  }

  // Planned ops summary
  console.log('\n[fix] PLAN:');
  for (const [playerId, ids] of Object.entries(DUP_IDS)) {
    console.log(`  DELETE ${ids.flat} (${playerId} varus_flat dup)`);
    console.log(`  DELETE ${ids.top10} (${playerId} varus_top10 dup)`);
  }
  for (const row of REATTRIBUTIONS) {
    console.log(`  INSERT buff ${row.playerId} match=${row.targetMatchId} varus_flat +${FLAT_VALUE}`);
    console.log(`  INSERT buff ${row.playerId} match=${row.targetMatchId} varus_top10 +${TOP10_VALUE}`);
  }

  if (!APPLY) {
    console.log('\n[fix] DRY-RUN complete. Re-run with --apply to mutate.');
    await mongoose.disconnect();
    return;
  }

  console.log('\n[fix] Applying changes...');

  const now = new Date();
  const deleteIds = Object.values(DUP_IDS).flatMap((ids) => [ids.flat, ids.top10])
    .map((id) => new mongoose.Types.ObjectId(id));

  const inserts = REATTRIBUTIONS.flatMap((row) => [
    {
      playerId: row.playerId,
      godSlug: GOD,
      type: 'buff' as const,
      value: FLAT_VALUE,
      source: 'varus_flat',
      matchId: row.targetMatchId,
      day: DAY,
      phase: PHASE,
      createdAt: now,
    },
    {
      playerId: row.playerId,
      godSlug: GOD,
      type: 'buff' as const,
      value: TOP10_VALUE,
      source: 'varus_top10',
      matchId: row.targetMatchId,
      day: DAY,
      phase: PHASE,
      createdAt: now,
    },
  ]);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const deleteResult = await PointTransaction.deleteMany({ _id: { $in: deleteIds } }).session(session);
      if (deleteResult.deletedCount !== 4) {
        throw new Error(`[fix] Expected to delete 4 docs, actually deleted ${deleteResult.deletedCount}`);
      }
      const insertResult = await PointTransaction.insertMany(inserts, { session });
      if (insertResult.length !== 4) {
        throw new Error(`[fix] Expected to insert 4 docs, actually inserted ${insertResult.length}`);
      }
      console.log(`[fix]   deleted=${deleteResult.deletedCount} inserted=${insertResult.length}`);
    });
  } finally {
    await session.endSession();
  }

  console.log('[fix] APPLY complete.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[fix] Failed:', error);
  process.exit(1);
});
