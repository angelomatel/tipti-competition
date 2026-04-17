const watchDelayMs = 5000;

/**
 * PM2 development processes.
 * Each app runs its package's `npm run dev` and restarts 5 seconds after a
 * watched file change. Use the PowerShell helper in `scripts/pm2-dev.ps1`
 * to start/stop these apps so "off" fully removes the PM2 watcher.
 */
module.exports = {
  apps: [
    {
      name: 'frontend-dev',
      cwd: '.',
      script: 'node',
      args: 'scripts/pm2-run-dev.js frontend',
      watch: [
        'frontend/app',
        'frontend/src',
        'frontend/public',
        'frontend/.env',
        'frontend/package.json',
        'frontend/next.config.ts',
        'frontend/tsconfig.json',
        'frontend/postcss.config.mjs',
        'frontend/eslint.config.mjs',
      ],
      watch_delay: watchDelayMs,
      ignore_watch: ['frontend/node_modules', 'frontend/.next', '.git', 'frontend/tsconfig.tsbuildinfo', '.*__tests__.*'],
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'backend-dev',
      cwd: '.',
      script: 'node',
      args: 'scripts/pm2-run-dev.js backend',
      watch: [
        'backend/src',
        'backend/scripts',
        'backend/.env',
        'backend/package.json',
        'backend/tsconfig.json',
        'backend/vitest.config.ts',
      ],
      watch_delay: watchDelayMs,
      ignore_watch: ['backend/node_modules', 'backend/dist', 'backend/logs', '.git', '.*__tests__.*'],
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'tipti-clanker-dev',
      cwd: '.',
      script: 'node',
      args: 'scripts/pm2-run-dev.js tipti-clanker',
      watch: [
        'tipti-clanker/src',
        'tipti-clanker/.env',
        'tipti-clanker/package.json',
        'tipti-clanker/tsconfig.json',
        'tipti-clanker/vitest.config.ts',
        'tipti-clanker/vitest.config.js',
      ],
      watch_delay: watchDelayMs,
      ignore_watch: ['tipti-clanker/node_modules', 'tipti-clanker/build', '.git', '.*__tests__.*'],
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
