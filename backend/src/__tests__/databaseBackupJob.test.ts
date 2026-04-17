import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createDatabaseBackupFilename,
  pruneDatabaseBackupFiles,
} from '@/jobs/databaseBackupJob';

const tempDirs: string[] = [];

describe('databaseBackupJob', () => {
  afterEach(async () => {
    await Promise.all(
      tempDirs.splice(0).map(async (dir) => {
        await rm(dir, { recursive: true, force: true });
      }),
    );
  });

  it('builds a stable backup filename for the target db', () => {
    const fileName = createDatabaseBackupFilename('tft-tournament', new Date('2026-04-17T12:00:00.000Z'));
    expect(fileName).toBe('mongo-backup-tft-tournament-2026-04-17T12-00-00Z.json.gz');
  });

  it('keeps the newest backup files and ignores unrelated files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tipti-backup-test-'));
    tempDirs.push(dir);

    const files = [
      'mongo-backup-tft-tournament-2026-04-17T00-00-00Z.json.gz',
      'mongo-backup-tft-tournament-2026-04-17T12-00-00Z.json.gz',
      'mongo-backup-tft-tournament-2026-04-18T00-00-00Z.json.gz',
      'notes.txt',
    ];

    await Promise.all(files.map(async (fileName) => writeFile(join(dir, fileName), fileName)));

    const pruned = await pruneDatabaseBackupFiles(dir, 'tft-tournament', 2);
    const remaining = (await readdir(dir)).sort();

    expect(pruned).toEqual(['mongo-backup-tft-tournament-2026-04-17T00-00-00Z.json.gz']);
    expect(remaining).toEqual([
      'mongo-backup-tft-tournament-2026-04-17T12-00-00Z.json.gz',
      'mongo-backup-tft-tournament-2026-04-18T00-00-00Z.json.gz',
      'notes.txt',
    ]);
  });
});
