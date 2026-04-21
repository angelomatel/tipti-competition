/**
 * One-shot fix for MatchRecords with buffProcessed=true, buffSkipReason=null, no PointTransaction.
 *
 * Three cases:
 *   1. aurelion_sol        → buffSkipReason: 'rule_rolled_zero'    (no tx needed)
 *   2. yasuo placement 1-4 → buffSkipReason: 'rule_returned_empty' (no tx needed)
 *   3. varus (all), yasuo placement 5-8
 *                          → insert missing transactions (or 'daily_cap_hit' if cap exhausted)
 *
 * Usage:
 *   MONGODB_DB_NAME=tft-tournament npx tsx src/scripts/fixMissingMatchBuffs.ts [--apply] [--uri=<mongodb_uri>]
 *
 * Default is dry-run. Pass --apply to write changes.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '@/db/connection';
import { God } from '@/db/models/God';
import { MatchRecord } from '@/db/models/MatchRecord';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { TournamentSettings } from '@/db/models/TournamentSettings';
import { dateToPhtDayStr, getPhtDayBounds } from '@/lib/dateUtils';
import { computePlayerScoreTotals } from '@/services/scoringEngine';
import { buildGodRankings } from '@/services/matchBuffProcessor/context';
import { getDailyCap } from '@/services/matchBuffProcessor/rules';
import {
  VARUS_FLAT_PER_MATCH,
  VARUS_TOP10_BONUS,
  VARUS_TOP_N,
  YASUO_PLACEMENT_BONUSES,
} from '@/constants';
import type { BuffSkipReason } from '@/types/Player';

function parseArgs(): { apply: boolean; uriOverride: string | null } {
  const args = process.argv.slice(2);
  let apply = false;
  let uriOverride: string | null = null;
  for (const arg of args) {
    if (arg === '--apply') apply = true;
    const m = arg.match(/^--uri=(.+)$/);
    if (m) uriOverride = m[1]!;
  }
  return { apply, uriOverride };
}

interface TransactionDoc {
  playerId: string;
  godSlug: string;
  type: 'buff' | 'penalty';
  value: number;
  source: string;
  matchId: string;
  day: string;
  phase: number;
}

interface MatchUpdate {
  _id: unknown;
  skipReason: BuffSkipReason;
}

function buildVarusEntries(rank: number): Array<{ value: number; source: string }> {
  const entries: Array<{ value: number; source: string }> = [
    { value: VARUS_FLAT_PER_MATCH, source: 'varus_flat' },
  ];
  if (rank <= VARUS_TOP_N) {
    entries.push({ value: VARUS_TOP10_BONUS, source: 'varus_top10' });
  }
  return entries;
}

function buildYasuoEntry(placement: number): { value: number; source: string } | null {
  if (placement < 5 || placement > 8) return null;
  return { value: YASUO_PLACEMENT_BONUSES[placement - 5]!, source: `yasuo_${placement}th` };
}

async function main(): Promise<void> {
  const { apply, uriOverride } = parseArgs();
  if (uriOverride) process.env['MONGODB_URI'] = uriOverride;

  await connectDB();

  const settings = await TournamentSettings.findOne().lean();
  const phase2 = settings?.phases.find((p) => p.phase === 2);
  if (!phase2) {
    console.error('Phase 2 not found in TournamentSettings. Aborting.');
    await mongoose.disconnect();
    return;
  }
  const buffActivationStart = getPhtDayBounds(phase2.startDay).dayStart;

  function getPhaseForDay(day: string): number {
    return settings!.phases.find((p) => day >= p.startDay && day <= p.endDay)?.phase
      ?? settings!.currentPhase;
  }

  // Scope: active players on alive gods
  const activeGodSlugs = (await God.find({ isEliminated: false }).select({ slug: 1 }).lean())
    .map((g) => g.slug);

  const players = await Player.find({
    isActive: true,
    isEliminatedFromGod: false,
    godSlug: { $in: activeGodSlugs },
  })
    .select({ discordId: 1, puuid: 1, godSlug: 1, riotId: 1, currentTier: 1 })
    .lean();

  if (players.length === 0) {
    console.log('No eligible players. Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  const puuids = players.map((p) => p.puuid);
  const playerIds = players.map((p) => p.discordId);
  const playerByPuuid = new Map(players.map((p) => [p.puuid, p]));

  // Varus ranking (used to determine varus_top10 eligibility)
  const scoreTotals = await computePlayerScoreTotals(playerIds);
  const godRankings = buildGodRankings(players as any, scoreTotals);
  const varusRankings = godRankings.get('varus') ?? new Map<string, number>();

  // Find candidates: buffProcessed=true, buffSkipReason=null, Phase 2+
  const candidates = await MatchRecord.find({
    puuid: { $in: puuids },
    playedAt: { $gte: buffActivationStart },
    buffProcessed: true,
    buffSkipReason: null,
  })
    .select({ _id: 1, puuid: 1, matchId: 1, placement: 1, playedAt: 1 })
    .sort({ playedAt: 1 })
    .lean();

  if (candidates.length === 0) {
    console.log('No candidates found. Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  // Find which candidates already have a buff/penalty transaction (should be none, but be safe)
  const existingTx = await PointTransaction.find({
    playerId: { $in: playerIds },
    type: { $in: ['buff', 'penalty'] },
    matchId: { $in: candidates.map((m) => m.matchId) },
  })
    .select({ playerId: 1, matchId: 1 })
    .lean();

  const hasBuffTx = new Set(existingTx.filter((tx) => tx.matchId != null).map((tx) => `${tx.playerId}:${tx.matchId}`));

  const missing = candidates.filter((m) => {
    const player = playerByPuuid.get(m.puuid);
    return player && !hasBuffTx.has(`${player.discordId}:${m.matchId}`);
  });

  if (missing.length === 0) {
    console.log('All candidates already have transactions. Nothing to fix.');
    await mongoose.disconnect();
    return;
  }

  // Load current daily buff totals for cap accounting
  const affectedDays = [...new Set(missing.map((m) => dateToPhtDayStr(m.playedAt)))];
  const affectedPlayerIds = [...new Set(missing.map((m) => playerByPuuid.get(m.puuid)?.discordId).filter(Boolean))] as string[];

  const buffTotalRows = await PointTransaction.aggregate<{
    _id: { playerId: string; day: string };
    total: number;
  }>([
    {
      $match: {
        playerId: { $in: affectedPlayerIds },
        day: { $in: affectedDays },
        type: 'buff',
      },
    },
    { $group: { _id: { playerId: '$playerId', day: '$day' }, total: { $sum: '$value' } } },
  ]);

  const dailyTotals = new Map<string, number>(
    buffTotalRows.map((row) => [`${row._id.playerId}:${row._id.day}`, row.total]),
  );

  // Build fix actions
  const transactionDocs: TransactionDoc[] = [];
  const matchUpdates: MatchUpdate[] = [];
  let labelOnlyCount = 0;
  let txCount = 0;
  let capCount = 0;

  for (const match of missing) {
    const player = playerByPuuid.get(match.puuid)!;
    const godSlug = player.godSlug!;
    const matchDay = dateToPhtDayStr(match.playedAt);
    const phase = getPhaseForDay(matchDay);

    // Label-only: ASol (rule_rolled_zero) and Yasuo wins (rule_returned_empty)
    if (godSlug === 'aurelion_sol') {
      matchUpdates.push({ _id: match._id, skipReason: 'rule_rolled_zero' });
      labelOnlyCount++;
      console.log(`  [label] ${player.riotId ?? player.discordId}  matchId=${match.matchId}  → rule_rolled_zero`);
      continue;
    }

    if (godSlug === 'yasuo' && match.placement <= 4) {
      matchUpdates.push({ _id: match._id, skipReason: 'rule_returned_empty' });
      labelOnlyCount++;
      console.log(`  [label] ${player.riotId ?? player.discordId}  matchId=${match.matchId}  placement=${match.placement}  → rule_returned_empty`);
      continue;
    }

    // Transaction cases: Varus and Yasuo 5-8
    const rawEntries = godSlug === 'varus'
      ? buildVarusEntries(varusRankings.get(player.discordId) ?? 999)
      : [buildYasuoEntry(match.placement)!];

    const cap = getDailyCap(godSlug);
    const totalKey = `${player.discordId}:${matchDay}`;
    let currentTotal = dailyTotals.get(totalKey) ?? 0;
    let writtenForMatch = 0;

    for (const entry of rawEntries) {
      const remaining = cap - currentTotal;
      if (remaining <= 0) break;
      const finalValue = Math.min(entry.value, remaining);
      currentTotal += finalValue;

      transactionDocs.push({
        playerId: player.discordId,
        godSlug,
        type: 'buff',
        value: finalValue,
        source: entry.source,
        matchId: match.matchId,
        day: matchDay,
        phase,
      });
      writtenForMatch++;
      console.log(`  [tx]    ${player.riotId ?? player.discordId}  matchId=${match.matchId}  placement=${match.placement}  +${finalValue} (${entry.source})`);
    }

    dailyTotals.set(totalKey, currentTotal);

    if (writtenForMatch === 0) {
      matchUpdates.push({ _id: match._id, skipReason: 'daily_cap_hit' });
      capCount++;
      console.log(`  [cap]   ${player.riotId ?? player.discordId}  matchId=${match.matchId}  placement=${match.placement}  → daily_cap_hit`);
    } else {
      txCount++;
    }
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Missing matches found   : ${missing.length}`);
  console.log(`  Label-only fixes        : ${labelOnlyCount}  (rule_rolled_zero / rule_returned_empty)`);
  console.log(`  Matches needing tx      : ${txCount}  (${transactionDocs.length} transaction doc(s) total)`);
  console.log(`  Capped out              : ${capCount}  (daily_cap_hit)`);

  if (!apply) {
    console.log('\n  DRY RUN — pass --apply to write changes.\n');
    console.log('══════════════════════════════════════════════════════\n');
    await mongoose.disconnect();
    return;
  }

  console.log('\n  Applying...');

  if (transactionDocs.length > 0) {
    await PointTransaction.insertMany(transactionDocs, { ordered: false });
    console.log(`  ✓ Inserted ${transactionDocs.length} PointTransaction(s)`);
  }

  if (matchUpdates.length > 0) {
    await MatchRecord.bulkWrite(
      matchUpdates.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { buffSkipReason: u.skipReason } },
        },
      })),
    );
    console.log(`  ✓ Updated buffSkipReason on ${matchUpdates.length} MatchRecord(s)`);
  }

  console.log('\n  ✓ Done.\n');
  console.log('══════════════════════════════════════════════════════\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
