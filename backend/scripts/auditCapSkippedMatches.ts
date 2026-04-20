import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';

if (!MONGODB_URI) throw new Error('MONGODB_URI not set');

const TARGETS: Array<{ discordId?: string; riotLabel: string }> = [
  { riotLabel: 'AXM Nanande#nana' },
  { riotLabel: 'AXM Kohane#jckpt' },
];
const DAY = '2026-04-20';
const DUPLICATE_IDS_TO_REMOVE = [
  '69e50b478d7b421102e77aa9',
  '69e50b478d7b421102e77aaa',
  '69e50b478d7b421102e77aac',
  '69e50b478d7b421102e77aab',
];

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI!, { dbName: DB_NAME });
  console.log(`[audit-cap] Connected to ${DB_NAME}`);

  const { PointTransaction } = await import('@/db/models/PointTransaction');
  const { Player } = await import('@/db/models/Player');
  const { MatchRecord } = await import('@/db/models/MatchRecord');
  const { getDailyCap } = await import('@/services/matchBuffProcessor/rules');
  const { VARUS_FLAT_PER_MATCH, VARUS_TOP10_BONUS, VARUS_TOP_N } = await import('@/constants');
  const { dateToPhtDayStr } = await import('@/lib/dateUtils');

  for (const target of TARGETS) {
    const [gameName, tagLine] = target.riotLabel.split('#');
    const player = await Player.findOne({ gameName, tagLine }).lean();
    if (!player) {
      console.log(`[audit-cap] Player not found: ${target.riotLabel}`);
      continue;
    }

    const discordId = player.discordId;
    const godSlug = player.godSlug;
    const cap = getDailyCap(godSlug);

    console.log(`\n=== ${target.riotLabel} (discordId=${discordId}, god=${godSlug}, cap=${cap}) on ${DAY} ===`);

    const allBuffTxns = await PointTransaction.find({
      playerId: discordId,
      day: DAY,
      type: 'buff',
    }).sort({ createdAt: 1 }).lean();

    const currentTotal = allBuffTxns.reduce((sum, txn) => sum + txn.value, 0);
    const dupIds = new Set(DUPLICATE_IDS_TO_REMOVE);
    const dupTotal = allBuffTxns
      .filter((txn) => dupIds.has(String(txn._id)))
      .reduce((sum, txn) => sum + txn.value, 0);
    const postCleanupTotal = currentTotal - dupTotal;
    const freedHeadroom = Math.min(dupTotal, Math.max(0, cap - postCleanupTotal));

    console.log(`  current buff total: ${currentTotal}`);
    console.log(`  duplicates to remove (sum): ${dupTotal}`);
    console.log(`  total after cleanup: ${postCleanupTotal} (cap=${cap}, headroom after cleanup=${cap - postCleanupTotal})`);

    const matches = await MatchRecord.find({ puuid: player.puuid })
      .sort({ playedAt: 1 })
      .lean();
    const matchesOnDay = matches.filter((match) => dateToPhtDayStr(match.playedAt) === DAY);
    console.log(`  matches on ${DAY}: ${matchesOnDay.length}`);

    const buffsByMatchId = new Map<string, typeof allBuffTxns>();
    for (const txn of allBuffTxns) {
      if (!txn.matchId) continue;
      const list = buffsByMatchId.get(txn.matchId) ?? [];
      list.push(txn);
      buffsByMatchId.set(txn.matchId, list);
    }

    const rankingSample = await PointTransaction.aggregate([
      { $match: { godSlug } },
      { $group: { _id: '$playerId', total: { $sum: '$value' } } },
      { $sort: { total: -1 } },
    ]);
    const varusRank = rankingSample.findIndex((row) => row._id === discordId) + 1;
    const isTopN = varusRank > 0 && varusRank <= VARUS_TOP_N;
    console.log(`  varus score rank: ${varusRank} (top${VARUS_TOP_N}? ${isTopN})`);

    let reattributable = 0;
    const cappedMatches: Array<{ matchId: string; placement: number; wouldAward: number }> = [];

    for (const match of matchesOnDay) {
      const currentMatchBuffs = (buffsByMatchId.get(match.matchId) ?? [])
        .filter((txn) => !dupIds.has(String(txn._id)));
      const currentAwarded = currentMatchBuffs.reduce((sum, txn) => sum + txn.value, 0);
      const expectedAward = VARUS_FLAT_PER_MATCH + (isTopN ? VARUS_TOP10_BONUS : 0);

      const mark = match.buffProcessed ? '✓' : '○';
      console.log(
        `    ${mark} match=${match.matchId} placement=${match.placement} playedAt=${match.playedAt.toISOString()} buffProcessed=${match.buffProcessed} currentAward=${currentAwarded} (expected=${expectedAward})`,
      );

      if (match.buffProcessed && currentAwarded < expectedAward) {
        const gap = expectedAward - currentAwarded;
        cappedMatches.push({ matchId: match.matchId, placement: match.placement, wouldAward: gap });
      }
    }

    for (const entry of cappedMatches) {
      if (reattributable >= freedHeadroom) break;
      const award = Math.min(entry.wouldAward, freedHeadroom - reattributable);
      reattributable += award;
      console.log(`    ↳ REATTRIBUTE: match=${entry.matchId} placement=${entry.placement} +${award}`);
    }
    console.log(`  total reattributable: ${reattributable} (of ${freedHeadroom} freed)`);
    console.log(`  NET change for player: ${-dupTotal + reattributable} pts`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('[audit-cap] Failed:', error);
  process.exit(1);
});
