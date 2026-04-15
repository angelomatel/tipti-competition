'use strict';

const http = require('http');
const { shouldHandlePayload, verifySignature } = require('./githubWebhook');

function createServer(config, deployQueue) {
  return http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/payload') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const signature = req.headers['x-hub-signature-256'];

      if (!verifySignature(body, signature, config.webhookSecret)) {
        console.warn('[webhook] Invalid or missing signature.');
        res.writeHead(401);
        res.end('Invalid signature');
        return;
      }

      if (!shouldHandlePayload(req, body, config.deployBranch)) {
        res.writeHead(202);
        res.end('Ignored');
        return;
      }

      const wasRunning = deployQueue.isRunning();
      void deployQueue.drain();
      res.writeHead(wasRunning ? 202 : 200);
      res.end(wasRunning ? 'Deploy queued' : 'Deploy started');
    });
  });
}

module.exports = {
  createServer,
};
