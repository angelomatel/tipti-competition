/**
 * One-shot fix for LP delta inflation caused by Master/Grandmaster/Challenger having
 * different TIER_ORDER values in normalizeLP. Going from Master→Grandmaster inflated
 * the delta by 400 points (one full tier slot) instead of recording only the actual LP change.
 *
 * Fix: recompute expectedTotal with the corrected normalizeLP for each affected player
 * and insert a compensating lp_delta_correction transaction.
 *
 * Usage:
 *   MONGODB_DB_NAME=tft-competition npx tsx src/scripts/fixMasterPlusLpInflation.ts [--apply] [--uri=<mongodb_uri>]
 *
 * Default is dry-run. Pass --apply to write changes.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '@/db/connection';
import { LpSnapshot } from '@/db/models/LpSnapshot';
import { Player } from '@/db/models/Player';
import { PointTransaction } from '@/db/models/PointTransaction';
import { TournamentSettings } from '@/db/models/TournamentSettings';
import { getCurrentPhtDay } from '@/lib/dateUtils';
import { normalizeLP } from '@/lib/normalizeLP';

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

async function main(): Promise<void> {
  const { apply, uriOverride } = parseArgs();
  if (uriOverride) process.env['MONGODB_URI'] = uriOverride;

  await connectDB();

  const settings = await TournamentSettings.findOne().lean();
  if (!settings) {
    console.error('TournamentSettings not found. Aborting.');
    await mongoose.disconnect();
    return;
  }

  const today = getCurrentPhtDay();

  function getPhaseForDay(day: string): number {
    return (
      settings!.phases.find((p) => day >= p.startDay && day <= p.endDay)?.phase ??
      settings!.currentPhase
    );
  }

  const players = await Player.find({ isActive: true, godSlug: { $ne: null } })
    .select({
      discordId: 1,
      puuid: 1,
      godSlug: 1,
      riotId: 1,
      currentTier: 1,
      currentRank: 1,
      currentLP: 1,
      lpBaselineNorm: 1,
      lpBaselineOffset: 1,
    })
    .lean();

  console.log(`Checking ${players.length} active players with a god assignment…\n`);

  let correctionCount = 0;

  for (const player of players) {
    const currentNorm = normalizeLP(player.currentTier, player.currentRank, player.currentLP);

    let expectedTotal: number;

    if (player.lpBaselineNorm !== null && player.lpBaselineNorm !== undefined) {
      expectedTotal = player.lpBaselineOffset + (currentNorm - player.lpBaselineNorm);
    } else {
      const baseline = await LpSnapshot.findOne({
        puuid: player.puuid,
        capturedAt: { $gte: settings.startDate },
      })
        .sort({ capturedAt: 1 })
        .lean();

      if (!baseline) {
        console.log(`  [SKIP] ${player.riotId ?? player.discordId} — no baseline snapshot`);
        continue;
      }

      const baseNorm = normalizeLP(baseline.tier, baseline.rank, baseline.leaguePoints);
      expectedTotal = currentNorm - baseNorm;
    }

    const result = await PointTransaction.aggregate([
      { $match: { playerId: player.discordId, type: 'match' } },
      { $group: { _id: null, total: { $sum: '$value' } } },
    ]);
    const existingTotal: number = result[0]?.total ?? 0;

    const discrepancy = expectedTotal - existingTotal;

    if (discrepancy === 0) continue;

    // Only fix discrepancies that are exact multiples of 400 — the signature of the
    // Master/GM/Challenger tier-value inflation bug. Small drift is pipeline lag and
    // will self-correct on the player's next match.
    if (discrepancy % 400 !== 0) {
      console.log(
        `  [SKIP] ${player.riotId ?? player.discordId} — discrepancy=${discrepancy} (not a Master+ inflation multiple, skipping)`,
      );
      continue;
    }

    const label = player.riotId ?? player.discordId;
    console.log(
      `  [FIX] ${label} (${player.currentTier} ${player.currentLP}LP)` +
        ` — expectedTotal=${expectedTotal}, existingTotal=${existingTotal}, correction=${discrepancy}`,
    );

    if (apply) {
      await PointTransaction.create({
        playerId: player.discordId,
        godSlug: player.godSlug,
        type: 'match',
        value: discrepancy,
        source: 'lp_delta_correction',
        matchId: null,
        day: today,
        phase: getPhaseForDay(today),
      });
    }

    correctionCount++;
  }

  console.log(
    `\nDone. ${correctionCount} player(s) need correction.` +
      (apply ? ' Corrections written.' : ' Dry-run — rerun with --apply to write.'),
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
