#!/usr/bin/env node
'use strict';

const { getConfig } = require('./helper/config');
const { createDeploy } = require('./helper/deploy');
const { createDeployQueue } = require('./helper/deployQueue');
const { createServer } = require('./helper/webhookServer');

function main() {
  const config = getConfig();

  if (!config.webhookSecret) {
    console.error('WEBHOOK_SECRET is required.');
    process.exit(1);
  }

  const { deployOnce } = createDeploy(config);
  const deployQueue = createDeployQueue(deployOnce);

  createServer(config, deployQueue).listen(config.port, config.host, () => {
    console.log(`Webhook deployer listening at http://${config.host}:${config.port}/payload`);
    console.log(`Repo dir: ${config.repoDir}`);
    console.log(`Deploy branch: ${config.remoteName}/${config.deployBranch}`);
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  main,
};
