/**
 * Verifies that every processed match for players with alive gods has the expected
 * buff/penalty PointTransactions. Exits with code 1 if any anomalies are found.
 *
 * Usage:
 *   npx tsx src/scripts/verifyMatchBuffs.ts [--god=<slug>] [--player=<discordId>] [--uri=<mongodb_uri>]
 *
 * --uri overrides MONGODB_URI from .env, useful for pointing at a local test database.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '@/db/connection';
import { God } from '@/db/models/God';
import { MatchRecord } from '@/db/models/MatchRecord';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { TournamentSettings } from '@/db/models/TournamentSettings';
import { getPhtDayBounds } from '@/lib/dateUtils';

interface MissingMatch {
  matchId: string;
  placement: number;
  playedAt: Date;
}

interface PlayerResult {
  discordId: string;
  riotId: string;
  godSlug: string;
  total: number;
  pending: number;
  withBuffs: number;
  skippedBeforeActivation: number;
  skippedRuleEmpty: number;
  skippedDailyCap: number;
  skippedNoPlayer: number;
  missing: MissingMatch[];
}

function parseArgs(): { godFilter: string | null; playerFilter: string | null; uriOverride: string | null } {
  const args = process.argv.slice(2);
  let godFilter: string | null = null;
  let playerFilter: string | null = null;
  let uriOverride: string | null = null;
  for (const arg of args) {
    const godMatch = arg.match(/^--god=(.+)$/);
    const playerMatch = arg.match(/^--player=(.+)$/);
    const uriMatch = arg.match(/^--uri=(.+)$/);
    if (godMatch) godFilter = godMatch[1]!;
    if (playerMatch) playerFilter = playerMatch[1]!;
    if (uriMatch) uriOverride = uriMatch[1]!;
  }
  return { godFilter, playerFilter, uriOverride };
}

function fmt(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

async function main(): Promise<void> {
  const { godFilter, playerFilter, uriOverride } = parseArgs();

  if (uriOverride) process.env['MONGODB_URI'] = uriOverride;

  await connectDB();

  // 1. Resolve which god slugs are in scope (alive only)
  const godQuery = godFilter
    ? { slug: godFilter, isEliminated: false }
    : { isEliminated: false };
  const activeGods = await God.find(godQuery).select({ slug: 1, name: 1 }).lean();

  if (activeGods.length === 0) {
    const label = godFilter ? `god "${godFilter}"` : 'any active god';
    console.log(`No alive gods found for ${label}. Nothing to verify.`);
    await mongoose.disconnect();
    return;
  }

  const activeGodSlugs = activeGods.map((g) => g.slug);
  const godNameBySlug = new Map(activeGods.map((g) => [g.slug, g.name]));

  // 2. Resolve which players are in scope
  const playerQuery: Record<string, unknown> = {
    isActive: true,
    isEliminatedFromGod: false,
    godSlug: { $in: activeGodSlugs },
  };
  if (playerFilter) playerQuery['discordId'] = playerFilter;

  const players = await Player.find(playerQuery)
    .select({ discordId: 1, puuid: 1, godSlug: 1, riotId: 1 })
    .lean();

  if (players.length === 0) {
    console.log('No eligible players found for the given filters. Nothing to verify.');
    await mongoose.disconnect();
    return;
  }

  const puuids = players.map((p) => p.puuid);
  const playerIds = players.map((p) => p.discordId);
  const playerByPuuid = new Map(players.map((p) => [p.puuid, p]));

  // 3. Resolve Phase 2 start so we only check matches that should have buffs
  const settings = await TournamentSettings.findOne().lean();
  const phase2 = settings?.phases.find((p) => p.phase === 2);
  const buffActivationStart = phase2 ? getPhtDayBounds(phase2.startDay).dayStart : null;

  if (!buffActivationStart) {
    console.log('Phase 2 start date not found in tournament settings — cannot determine buff window. Aborting.');
    await mongoose.disconnect();
    return;
  }

  // 4. Fetch only match records on or after Phase 2 start
  const allMatches = await MatchRecord.find({ puuid: { $in: puuids }, playedAt: { $gte: buffActivationStart } })
    .select({ puuid: 1, matchId: 1, placement: 1, playedAt: 1, buffProcessed: 1, buffSkipReason: 1 })
    .lean();

  // 5. Fetch all buff/penalty transactions for these players (only those tied to a match)
  const buffTxDocs = await PointTransaction.find({
    playerId: { $in: playerIds },
    type: { $in: ['buff', 'penalty'] },
    matchId: { $ne: null },
  })
    .select({ playerId: 1, matchId: 1 })
    .lean();

  // Build a set of "playerId:matchId" keys that have at least one buff/penalty transaction
  const hasBuffTx = new Set<string>(
    buffTxDocs
      .filter((tx) => tx.matchId != null)
      .map((tx) => `${tx.playerId}:${tx.matchId}`),
  );

  // 6. Analyze per player
  const resultByDiscordId = new Map<string, PlayerResult>();
  for (const player of players) {
    resultByDiscordId.set(player.discordId, {
      discordId: player.discordId,
      riotId: player.riotId,
      godSlug: player.godSlug!,
      total: 0,
      pending: 0,
      withBuffs: 0,
      skippedBeforeActivation: 0,
      skippedRuleEmpty: 0,
      skippedDailyCap: 0,
      skippedNoPlayer: 0,
      missing: [],
    });
  }

  for (const match of allMatches) {
    const player = playerByPuuid.get(match.puuid);
    if (!player) continue;
    const result = resultByDiscordId.get(player.discordId);
    if (!result) continue;

    result.total++;

    if (!match.buffProcessed) {
      result.pending++;
      continue;
    }

    const reason = match.buffSkipReason as string | null | undefined;

    if (reason === 'before_buff_activation') {
      result.skippedBeforeActivation++;
    } else if (reason === 'daily_cap_hit') {
      result.skippedDailyCap++;
    } else if (reason === 'rule_returned_empty' || reason === 'rule_rolled_zero') {
      result.skippedRuleEmpty++;
    } else if (reason === 'no_player') {
      result.skippedNoPlayer++;
    } else {
      // buffProcessed=true, no skip reason → buff/penalty transaction must exist
      if (hasBuffTx.has(`${player.discordId}:${match.matchId}`)) {
        result.withBuffs++;
      } else {
        result.missing.push({
          matchId: match.matchId,
          placement: match.placement,
          playedAt: match.playedAt,
        });
      }
    }
  }

  // 7. Render report
  const results = [...resultByDiscordId.values()];
  const godSlugs = [...new Set(results.map((r) => r.godSlug))].sort();

  let totalMissing = 0;
  let totalPending = 0;
  let totalWithBuffs = 0;
  let totalProcessed = 0;

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Match Buff Verification Report');
  console.log(`  Database     : ${uriOverride ?? process.env['MONGODB_URI'] ?? '(from .env)'}`);
  console.log(`  Buff window  : Phase 2 starts ${phase2!.startDay} (${fmt(buffActivationStart)} onward)`);
  if (godFilter) console.log(`  God filter   : ${godFilter}`);
  if (playerFilter) console.log(`  Player filter: ${playerFilter}`);
  console.log('══════════════════════════════════════════════════════\n');

  for (const godSlug of godSlugs) {
    const godName = godNameBySlug.get(godSlug) ?? godSlug;
    const godResults = results.filter((r) => r.godSlug === godSlug);
    const godMissing = godResults.reduce((sum, r) => sum + r.missing.length, 0);

    const statusIcon = godMissing > 0 ? '✗' : '✓';
    console.log(`── ${statusIcon} ${godName.toUpperCase()} (${godSlug}) ─────────────────────────`);

    for (const r of godResults) {
      const buffable = r.withBuffs + r.missing.length;
      const missIcon = r.missing.length > 0 ? ' ⚠' : '';
      console.log(
        `   ${r.riotId.padEnd(24)} ` +
        `total=${r.total}  ` +
        `buffed=${r.withBuffs}/${buffable}  ` +
        `cap=${r.skippedDailyCap}  ` +
        `rule_skip=${r.skippedRuleEmpty}  ` +
        `pre_phase=${r.skippedBeforeActivation}  ` +
        `pending=${r.pending}` +
        missIcon,
      );

      if (r.missing.length > 0) {
        for (const m of r.missing) {
          console.log(
            `     MISSING buff  matchId=${m.matchId}  ` +
            `placement=${m.placement}  played=${fmt(m.playedAt)}`,
          );
        }
      }

      if (r.skippedNoPlayer > 0) {
        console.log(`     NOTE: ${r.skippedNoPlayer} match(es) skipped with reason "no_player"`);
      }
    }

    console.log('');
    totalMissing += godMissing;
    totalPending += godResults.reduce((sum, r) => sum + r.pending, 0);
    totalWithBuffs += godResults.reduce((sum, r) => sum + r.withBuffs, 0);
    totalProcessed += godResults.reduce((sum, r) => sum + r.withBuffs + r.missing.length, 0);
  }

  console.log('══════════════════════════════════════════════════════');
  console.log(`  Players checked : ${players.length}`);
  console.log(`  Buffable matches: ${totalProcessed}  (buffed=${totalWithBuffs}, missing=${totalMissing})`);
  console.log(`  Pending matches : ${totalPending}`);

  if (totalMissing === 0) {
    console.log('\n  ✓ All checks passed — no missing buff transactions.\n');
  } else {
    console.log(`\n  ✗ ${totalMissing} match(es) are missing buff transactions.\n`);
  }
  console.log('══════════════════════════════════════════════════════\n');

  await mongoose.disconnect();

  if (totalMissing > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
