const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

module.exports = {
  queue: {
    filePath: path.join(dataDir, 'message-queue.dat'),
    encryptionKey: process.env.MESSAGE_QUEUE_KEY || 'local-dev-key',
    maxRetries: Number(process.env.MAX_QUEUE_RETRIES || 5),
    retryBaseMs: Number(process.env.QUEUE_RETRY_BASE_MS || 1000)
  },
  worker: {
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS || 250)
  },
  offline: {
    enabled: process.env.OFFLINE_MODE === 'true'
  }
};
