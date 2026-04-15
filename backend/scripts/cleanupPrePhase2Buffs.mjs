import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI;
const args = process.argv.slice(2);
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));
const DB_NAME = positionalArgs[0] ?? process.env.MONGODB_DB_NAME ?? 'tft-tournament-testing';
const SHOULD_APPLY = args.includes('--apply');
const FORCE_DESTRUCTIVE = args.includes('--force') || process.env.ALLOW_DESTRUCTIVE_MAINTENANCE === 'true';

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in backend/.env');
}

function assertSafeTargetDb(dbName) {
  const isSafe = /(test|testing|dev|local|sandbox)/i.test(dbName);
  if (!isSafe && !FORCE_DESTRUCTIVE) {
    throw new Error(
      `[safety] Refusing destructive run on DB "${dbName}". ` +
      'Use a test/dev DB name or pass --force (or ALLOW_DESTRUCTIVE_MAINTENANCE=true).',
    );
  }
}

function dateToUTC8Str(date) {
  return new Date(date.getTime() + UTC8_OFFSET_MS).toISOString().slice(0, 10);
}

function getDayStartUtcFromUtc8Date(dateStr) {
  return new Date(new Date(`${dateStr}T00:00:00.000Z`).getTime() - UTC8_OFFSET_MS);
}

function addDaysToDateStr(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function computePhases(startDate, endDate) {
  const day1 = dateToUTC8Str(startDate);
  const endDay = dateToUTC8Str(endDate);

  return [
    { phase: 1, startDay: day1, endDay: addDaysToDateStr(day1, 4), eliminationCount: 3 },
    { phase: 2, startDay: addDaysToDateStr(day1, 5), endDay: addDaysToDateStr(day1, 9), eliminationCount: 3 },
    { phase: 3, startDay: addDaysToDateStr(day1, 10), endDay, eliminationCount: 0 },
  ];
}

async function run() {
  if (args.includes('--help')) {
    console.log([
      'Usage:',
      '  node scripts/cleanupPrePhase2Buffs.mjs [dbName] [--apply] [--force]',
      '',
      'Examples:',
      '  node scripts/cleanupPrePhase2Buffs.mjs',
      '  node scripts/cleanupPrePhase2Buffs.mjs tft-tournament-testing',
      '  node scripts/cleanupPrePhase2Buffs.mjs tft-tournament --apply --force',
    ].join('\n'));
    return;
  }

  if (SHOULD_APPLY) {
    assertSafeTargetDb(DB_NAME);
  }

  await mongoose.connect(MONGODB_URI, { dbName: DB_NAME });
  const db = mongoose.connection.useDb(DB_NAME, { useCache: true }).db;

  const tournamentSettings = db.collection('tournament_settings');
  const matchRecords = db.collection('match_records');
  const pointTransactions = db.collection('point_transactions');
  const players = db.collection('players');

  const settings = await tournamentSettings.findOne(
    {},
    { projection: { startDate: 1, endDate: 1 } },
  );

  if (!settings?.startDate || !settings?.endDate) {
    throw new Error('Tournament settings with startDate/endDate were not found.');
  }

  const phases = computePhases(new Date(settings.startDate), new Date(settings.endDate));
  const phase2 = phases.find((phase) => phase.phase === 2);
  if (!phase2) {
    throw new Error('Phase 2 could not be derived from tournament settings.');
  }

  const phase2StartDay = phase2.startDay;
  const phase2StartAtUtc = getDayStartUtcFromUtc8Date(phase2StartDay);

  const badMatches = await matchRecords.find(
    { playedAt: { $lt: phase2StartAtUtc } },
    { projection: { matchId: 1, puuid: 1, playedAt: 1, placement: 1 } },
  ).toArray();

  const badMatchIds = badMatches
    .map((match) => match.matchId)
    .filter((matchId) => typeof matchId === 'string' && matchId.length > 0);

  if (badMatchIds.length === 0) {
    console.log(JSON.stringify({
      mode: SHOULD_APPLY ? 'apply' : 'dry-run',
      db: DB_NAME,
      phase2StartDay,
      phase2StartAtUtc: phase2StartAtUtc.toISOString(),
      candidateMatches: 0,
      candidateTransactions: 0,
      deletedTransactions: 0,
    }, null, 2));
    return;
  }

  const transactions = await pointTransactions.find({
    type: { $in: ['buff', 'penalty'] },
    matchId: { $in: badMatchIds },
  }).toArray();

  const puuids = [...new Set(
    badMatches
      .map((match) => match.puuid)
      .filter((puuid) => typeof puuid === 'string' && puuid.length > 0),
  )];

  const playerDocs = await players.find(
    { puuid: { $in: puuids } },
    { projection: { puuid: 1, discordId: 1, gameName: 1, tagLine: 1 } },
  ).toArray();

  const playerByPuuid = new Map(playerDocs.map((player) => [player.puuid, player]));
  const matchById = new Map(badMatches.map((match) => [match.matchId, match]));

  const summaryBySource = new Map();
  const summaryByPlayer = new Map();

  for (const tx of transactions) {
    const sourceKey = `${tx.type}:${tx.source}`;
    const sourceSummary = summaryBySource.get(sourceKey) ?? { count: 0, totalValue: 0 };
    sourceSummary.count += 1;
    sourceSummary.totalValue += tx.value ?? 0;
    summaryBySource.set(sourceKey, sourceSummary);

    const match = tx.matchId ? matchById.get(tx.matchId) : null;
    const player = match?.puuid ? playerByPuuid.get(match.puuid) : null;
    const playerKey = player
      ? `${player.discordId} (${player.gameName ?? 'unknown'}#${player.tagLine ?? 'unknown'})`
      : tx.playerId ?? 'unknown-player';
    const playerSummary = summaryByPlayer.get(playerKey) ?? { count: 0, totalValue: 0 };
    playerSummary.count += 1;
    playerSummary.totalValue += tx.value ?? 0;
    summaryByPlayer.set(playerKey, playerSummary);
  }

  let deletedTransactions = 0;
  if (SHOULD_APPLY && transactions.length > 0) {
    const txIds = transactions.map((tx) => tx._id);
    const result = await pointTransactions.deleteMany({ _id: { $in: txIds } });
    deletedTransactions = result.deletedCount ?? 0;
  }

  console.log(JSON.stringify({
    mode: SHOULD_APPLY ? 'apply' : 'dry-run',
    db: DB_NAME,
    phase2StartDay,
    phase2StartAtUtc: phase2StartAtUtc.toISOString(),
    candidateMatches: badMatches.length,
    candidateTransactions: transactions.length,
    deletedTransactions,
    sourceBreakdown: Object.fromEntries(
      [...summaryBySource.entries()].sort((a, b) => b[1].count - a[1].count),
    ),
    playerBreakdown: Object.fromEntries(
      [...summaryByPlayer.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 25),
    ),
  }, null, 2));
}

run()
  .catch((err) => {
    console.error('[cleanup-pre-phase2-buffs] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
