import cron from 'node-cron';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import { EJSON } from 'bson';
import mongoose from 'mongoose';
import {
  DATABASE_BACKUP_CRON,
  DATABASE_BACKUP_DIR,
  DATABASE_BACKUP_ENABLED,
  DATABASE_BACKUP_RETENTION_COUNT,
  DATABASE_BACKUP_TIMEZONE,
  MONGODB_DB_NAME,
} from '@/constants';
import { logger } from '@/lib/logger';

const BACKUP_FILE_EXTENSION = '.json.gz';
const BACKUP_FILE_PREFIX = 'mongo-backup';

let isBackupRunning = false;

function formatBackupTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

export function createDatabaseBackupFilename(dbName: string, date = new Date()): string {
  return `${BACKUP_FILE_PREFIX}-${dbName}-${formatBackupTimestamp(date)}${BACKUP_FILE_EXTENSION}`;
}

function isDatabaseBackupFile(fileName: string, dbName: string): boolean {
  return fileName.startsWith(`${BACKUP_FILE_PREFIX}-${dbName}-`) && fileName.endsWith(BACKUP_FILE_EXTENSION);
}

async function writeChunk(stream: NodeJS.WritableStream, chunk: string): Promise<void> {
  if (stream.write(chunk)) {
    return;
  }

  await once(stream, 'drain');
}

export async function pruneDatabaseBackupFiles(
  backupDir: string,
  dbName: string,
  retentionCount: number,
): Promise<string[]> {
  try {
    const fileNames = (await readdir(backupDir))
      .filter((fileName) => isDatabaseBackupFile(fileName, dbName))
      .sort()
      .reverse();

    const staleFiles = fileNames.slice(retentionCount);
    await Promise.all(
      staleFiles.map(async (fileName) => {
        await unlink(resolve(backupDir, fileName));
      }),
    );

    return staleFiles;
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return [];
    }

    throw err;
  }
}

type DatabaseBackupResult = {
  filePath: string;
  collectionCount: number;
  prunedFiles: string[];
  sizeBytes: number;
};

export async function createDatabaseBackup(): Promise<DatabaseBackupResult> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB is not connected');
  }

  const backupDir = resolve(process.cwd(), DATABASE_BACKUP_DIR);
  await mkdir(backupDir, { recursive: true });

  const filePath = resolve(backupDir, createDatabaseBackupFilename(MONGODB_DB_NAME));
  const gzip = createGzip({ level: 9 });
  const output = createWriteStream(filePath);

  const completion = new Promise<void>((resolvePromise, rejectPromise) => {
    output.on('close', () => resolvePromise());
    output.on('error', rejectPromise);
    gzip.on('error', rejectPromise);
  });

  gzip.pipe(output);

  try {
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collections
      .map((collection) => collection.name)
      .filter((name) => !name.startsWith('system.'));

    await writeChunk(
      gzip,
      JSON.stringify({
        meta: {
          dbName: MONGODB_DB_NAME,
          generatedAt: new Date().toISOString(),
          collectionCount: collectionNames.length,
        },
      }).replace(/}$/, ',"collections":{'),
    );

    for (const [collectionIndex, collectionName] of collectionNames.entries()) {
      await writeChunk(gzip, `${collectionIndex > 0 ? ',' : ''}${JSON.stringify(collectionName)}:[`);

      const cursor = db.collection(collectionName).find({});
      let isFirstDocument = true;

      for await (const document of cursor) {
        await writeChunk(
          gzip,
          `${isFirstDocument ? '' : ','}${EJSON.stringify(document, { relaxed: false })}`,
        );
        isFirstDocument = false;
      }

      await writeChunk(gzip, ']');
    }

    await writeChunk(gzip, '}}');
    gzip.end();
    await completion;

    const { size } = await stat(filePath);
    const prunedFiles = await pruneDatabaseBackupFiles(
      backupDir,
      MONGODB_DB_NAME,
      DATABASE_BACKUP_RETENTION_COUNT,
    );

    return {
      filePath,
      collectionCount: collectionNames.length,
      prunedFiles,
      sizeBytes: size,
    };
  } catch (err) {
    gzip.destroy();
    output.destroy();
    await unlink(filePath).catch(() => {});
    throw err;
  }
}

export async function runDatabaseBackupJob(): Promise<void> {
  if (isBackupRunning) {
    logger.warn('[backup] Previous database backup is still running. Skipping overlapping cycle.');
    return;
  }

  isBackupRunning = true;

  try {
    const result = await createDatabaseBackup();
    logger.info(
      {
        filePath: result.filePath,
        collectionCount: result.collectionCount,
        prunedCount: result.prunedFiles.length,
        sizeBytes: result.sizeBytes,
      },
      '[backup] Database backup complete',
    );
  } catch (err) {
    logger.error({ err }, '[backup] Database backup failed');
  } finally {
    isBackupRunning = false;
  }
}

export function startDatabaseBackupJob(): void {
  if (!DATABASE_BACKUP_ENABLED) {
    logger.info('[backup] Database backup job disabled.');
    return;
  }

  cron.schedule(
    DATABASE_BACKUP_CRON,
    () => {
      void runDatabaseBackupJob();
    },
    { timezone: DATABASE_BACKUP_TIMEZONE },
  );

  logger.info(
    `[backup] Database backup job scheduled (${DATABASE_BACKUP_CRON}, timezone=${DATABASE_BACKUP_TIMEZONE}).`,
  );
}
