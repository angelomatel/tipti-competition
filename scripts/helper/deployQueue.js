'use strict';

function createDeployQueue(deployOnce) {
  let running = false;
  let queued = false;

  async function drain() {
    if (running) {
      queued = true;
      return false;
    }

    running = true;

    try {
      do {
        queued = false;
        try {
          await deployOnce();
        } catch (err) {
          console.error('[deploy] Deploy failed:', err && err.message ? err.message : err);
          if (err && err.stderr) {
            console.error(err.stderr);
          }
        }
      } while (queued);
    } finally {
      running = false;
    }

    return true;
  }

  function isRunning() {
    return running;
  }

  return {
    drain,
    isRunning,
  };
}

module.exports = {
  createDeployQueue,
};
