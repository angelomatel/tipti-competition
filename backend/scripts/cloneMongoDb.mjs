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

const SOURCE_DB = process.argv[2] ?? 'tft-tournemnt';
const TARGET_DB = process.argv[3] ?? 'tft-tournament-testing';
const FORCE_DESTRUCTIVE = process.argv.includes('--force') || process.env.ALLOW_DESTRUCTIVE_MAINTENANCE === 'true';

function assertSafeTargetDb(dbName) {
  const isSafe = /(test|testing|dev|local|sandbox)/i.test(dbName);
  if (!isSafe && !FORCE_DESTRUCTIVE) {
    throw new Error(
      `[safety] Refusing overwrite of target DB "${dbName}". ` +
      'Use a test/dev target DB name or pass --force (or ALLOW_DESTRUCTIVE_MAINTENANCE=true).',
    );
  }
}

async function cloneDb() {
  assertSafeTargetDb(TARGET_DB);

  await mongoose.connect(uri, {
    dbName: SOURCE_DB,
  });

  const sourceDb = mongoose.connection.useDb(SOURCE_DB, { useCache: true }).db;
  const targetDb = mongoose.connection.useDb(TARGET_DB, { useCache: true }).db;

  const sourceCollections = await sourceDb.listCollections().toArray();

  if (sourceCollections.length === 0) {
    console.log(`[clone] No collections found in source DB: ${SOURCE_DB}`);
    return;
  }

  console.log(`[clone] Source collections: ${sourceCollections.length}`);

  for (const col of sourceCollections) {
    const name = col.name;
    const sourceCollection = sourceDb.collection(name);
    const targetCollection = targetDb.collection(name);

    const docs = await sourceCollection.find({}).toArray();

    await targetCollection.deleteMany({});
    if (docs.length > 0) {
      await targetCollection.insertMany(docs, { ordered: false });
    }

    console.log(`[clone] ${name}: copied ${docs.length} docs`);
  }

  console.log(`[clone] Completed: ${SOURCE_DB} -> ${TARGET_DB}`);
}

cloneDb()
  .catch((err) => {
    console.error('[clone] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
