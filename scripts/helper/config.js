'use strict';

const path = require('path');

function parseCsv(value, fallback) {
  return (value || fallback)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfig(env = process.env) {
  return {
    repoDir: env.REPO_DIR || path.resolve(__dirname, '..', '..'),
    webhookSecret: env.WEBHOOK_SECRET || '',
    host: env.HOST || '127.0.0.1',
    port: Number.parseInt(env.PORT || '3010', 10),
    remoteName: env.REMOTE_NAME || 'origin',
    deployBranch: env.DEPLOY_BRANCH || 'main',
    backendPm2Processes: parseCsv(env.BACKEND_PM2_PROCESSES, 'backend,backend-cron'),
    botPm2Process: env.BOT_PM2_PROCESS || 'tipti-bot',
  };
}

module.exports = {
  getConfig,
  parseCsv,
};
