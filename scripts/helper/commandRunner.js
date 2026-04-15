'use strict';

const { spawn } = require('child_process');

function run(command, args, options = {}) {
  const cwd = options.cwd;
  const label = [command, ...args].join(' ');
  console.log(`> (${cwd}) ${label}`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (options.capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      const err = new Error(`${label} failed with exit code ${code}`);
      err.stdout = stdout;
      err.stderr = stderr;
      reject(err);
    });
  });
}

function createGit(repoDir) {
  return function git(args, options = {}) {
    return run('git', args, { cwd: repoDir, ...options });
  };
}

module.exports = {
  createGit,
  run,
};
