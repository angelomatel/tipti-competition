/**
 * PM2 process split for production:
 * - backend serves HTTP only.
 * - backend-cron runs scheduled jobs only.
 * - tipti-bot remains the Discord bot process.
 */
module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'dist/server.js',
      cwd: './backend',
      watch: false,
      env: {
        NODE_ENV: 'production',
        BACKEND_MODE: 'http',
      },
    },
    {
      name: 'backend-cron',
      script: 'dist/server.js',
      cwd: './backend',
      watch: false,
      env: {
        NODE_ENV: 'production',
        BACKEND_MODE: 'cron',
      },
    },
    {
      name: 'tipti-bot',
      script: 'build/main.js',
      cwd: './tipti-clanker',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
