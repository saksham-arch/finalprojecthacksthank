const config = require('../config');

class QueueWorker {
  constructor({
    queue,
    twilioClient,
    ruleEngineCache,
    offlineController,
    offlineStore,
    logger = console,
    pollIntervalMs = config.worker.pollIntervalMs
  }) {
    this.queue = queue;
    this.twilioClient = twilioClient;
    this.ruleEngineCache = ruleEngineCache;
    this.offlineController = offlineController;
    this.offlineStore = offlineStore;
    this.logger = logger;
    this.pollIntervalMs = pollIntervalMs;
    this.interval = null;
  }

  async processOnce(now = Date.now()) {
    const dueEntries = await this.queue.getDueEntries(now);
    for (const entry of dueEntries) {
      if (entry.direction === 'outbound') {
        // eslint-disable-next-line no-await-in-loop
        await this._processOutbound(entry);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await this._processInbound(entry);
      }
    }
  }

  start() {
    if (this.interval) {
      return;
    }
    this.interval = setInterval(() => {
      this.processOnce().catch((error) => {
        this.logger.error('Queue worker error', error);
      });
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async _processOutbound(entry) {
    await this.queue.updateEntry(entry.id, {
      status: 'processing',
      updatedAt: new Date().toISOString()
    });

    if (this.offlineController?.isOffline()) {
      this.offlineStore?.record(entry);
      await this.queue.updateEntry(entry.id, {
        status: 'offline_pending',
        offlineMode: true,
        nextAttemptAt: Date.now() + this.pollIntervalMs
      });
      return;
    }

    try {
      await this._deliver(entry);
      await this.queue.updateEntry(entry.id, {
        status: 'succeeded',
        completedAt: new Date().toISOString(),
        offlineMode: false
      });
      this.offlineStore?.remove(entry.id);
    } catch (error) {
      const isNetworkError = this._isNetworkError(error);
      if (isNetworkError) {
        this.offlineController?.setOffline(true);
        this.offlineStore?.record(entry);
      }
      await this._scheduleRetry(entry, {
        offlineForced: isNetworkError,
        error
      });
    }
  }

  async _processInbound(entry) {
    await this.queue.updateEntry(entry.id, {
      status: 'processing'
    });
    await this.ruleEngineCache.processInboundResult(entry);
    await this.queue.updateEntry(entry.id, {
      status: 'succeeded',
      completedAt: new Date().toISOString()
    });
  }

  async _deliver(entry) {
    if (!this.twilioClient) {
      throw new Error('Twilio client is not configured');
    }
    if (entry.channel === 'voice') {
      return this.twilioClient.initiateVoiceCall(entry.payload);
    }
    return this.twilioClient.sendSms(entry.payload);
  }

  async _scheduleRetry(entry, { offlineForced = false, error }) {
    const nextRetryCount = (entry.retries || 0) + 1;
    if (nextRetryCount > entry.maxRetries) {
      await this.queue.updateEntry(entry.id, {
        status: 'failed',
        lastError: error ? error.message : 'Maximum retries exceeded',
        retries: nextRetryCount
      });
      return;
    }

    const backoffDelay = this._backoffDelay(nextRetryCount);
    await this.queue.updateEntry(entry.id, {
      status: offlineForced ? 'offline_pending' : 'retry_scheduled',
      retries: nextRetryCount,
      lastError: error ? error.message : null,
      offlineMode: offlineForced ? true : entry.offlineMode,
      nextAttemptAt: Date.now() + backoffDelay
    });
  }

  _backoffDelay(attempt) {
    const base = config.queue.retryBaseMs || 1000;
    return base * Math.pow(2, Math.max(0, attempt - 1));
  }

  _isNetworkError(error) {
    if (!error) {
      return false;
    }
    return (
      error.isNetworkError ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      /network/i.test(error.message || '')
    );
  }
}

module.exports = QueueWorker;
