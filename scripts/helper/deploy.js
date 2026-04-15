'use strict';

const path = require('path');
const { createGit, run } = require('./commandRunner');
const { includesFile, includesPath, splitLines } = require('./pathFilters');

async function assertCleanTrackedWorktree(git) {
  const status = await git(['status', '--porcelain', '--untracked-files=no'], { capture: true });
  if (status) {
    throw new Error(`Tracked worktree changes are present on the server:\n${status}`);
  }
}

function createDeploy(config) {
  const git = createGit(config.repoDir);

  async function restartPm2(processName) {
    await run('pm2', ['restart', processName], { cwd: config.repoDir });
  }

  async function deployBackend(changedFiles) {
    const cwd = path.join(config.repoDir, 'backend');

    if (includesFile(changedFiles, 'backend/package.json')) {
      await run('npm', ['install'], { cwd });
    }

    await run('npm', ['test', '--', '--run'], { cwd });
    await run('npm', ['run', 'build'], { cwd });

    for (const processName of config.backendPm2Processes) {
      await restartPm2(processName);
    }
  }

  async function deployBot(changedFiles) {
    const cwd = path.join(config.repoDir, 'tipti-clanker');

    if (includesFile(changedFiles, 'tipti-clanker/package.json')) {
      await run('npm', ['install'], { cwd });
    }

    await run('npm', ['run', 'build'], { cwd });
    await restartPm2(config.botPm2Process);
  }

  async function deployOnce() {
    console.log(`[deploy] Starting deploy for ${config.remoteName}/${config.deployBranch}`);
    await assertCleanTrackedWorktree(git);
    await git(['fetch', '--prune', config.remoteName, config.deployBranch]);

    const before = await git(['rev-parse', 'HEAD'], { capture: true });
    const remoteRef = `${config.remoteName}/${config.deployBranch}`;
    const after = await git(['rev-parse', remoteRef], { capture: true });

    if (before === after) {
      console.log('[deploy] Already up to date.');
      return;
    }

    const changedFiles = splitLines(await git(['diff', '--name-only', before, after], { capture: true }));
    const backendChanged = includesPath(changedFiles, 'backend/');
    const botChanged = includesPath(changedFiles, 'tipti-clanker/');

    console.log(`[deploy] Changed files:\n${changedFiles.map((file) => `  - ${file}`).join('\n')}`);

    await git(['merge', '--ff-only', remoteRef]);

    if (!backendChanged && !botChanged) {
      console.log('[deploy] No backend or tipti-clanker changes detected.');
      return;
    }

    if (backendChanged) {
      await deployBackend(changedFiles);
    }

    if (botChanged) {
      await deployBot(changedFiles);
    }

    console.log('[deploy] Deploy finished successfully.');
  }

  return {
    deployOnce,
  };
}

module.exports = {
  assertCleanTrackedWorktree,
  createDeploy,
};
