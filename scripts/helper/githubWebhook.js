'use strict';

const crypto = require('crypto');

function verifySignature(rawBody, signatureHeader, secret) {
  if (!secret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const expected = Buffer.from(
    `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`,
    'utf8',
  );
  const actual = Buffer.from(signatureHeader, 'utf8');

  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function shouldHandlePayload(req, body, deployBranch) {
  const eventName = req.headers['x-github-event'];
  if (eventName && eventName !== 'push') {
    return false;
  }

  try {
    const payload = JSON.parse(body.toString('utf8'));
    return payload.ref === `refs/heads/${deployBranch}`;
  } catch (err) {
    console.warn('[webhook] Invalid JSON payload:', err && err.message ? err.message : err);
    return false;
  }
}

module.exports = {
  shouldHandlePayload,
  verifySignature,
};
