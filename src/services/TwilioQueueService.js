const { v4: uuid } = require('uuid');
const config = require('../config');

const enforceOutboundBodyLimit = (body) => {
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('Message body is required.');
  }

  if (body.length > 160) {
    throw new Error('Message body must be 160 characters or fewer.');
  }
};

const normalizeInboundBody = (body) => {
  if (!body) {
    return { body: '', truncated: false };
  }
  if (body.length <= 160) {
    return { body, truncated: false };
  }
  return {
    body: body.slice(0, 160),
    truncated: true
  };
};

class TwilioQueueService {
  constructor({ queue, offlineController }) {
    this.queue = queue;
    this.offlineController = offlineController;
  }

  async enqueueOutboundMessage({ to, from, body, channel = 'sms', metadata = {} }) {
    if (!to || !from) {
      throw new Error('Outbound messages require both "to" and "from" fields.');
    }
    enforceOutboundBodyLimit(body);
    const nowIso = new Date().toISOString();
    const entry = {
      id: uuid(),
      direction: 'outbound',
      channel,
      payload: { to, from, body },
      status: 'queued',
      retries: 0,
      maxRetries: config.queue.maxRetries,
      offlineMode: this.offlineController?.isOffline() || false,
      nextAttemptAt: Date.now(),
      metadata,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await this.queue.enqueue(entry);
    return entry;
  }

  async enqueueInboundMessage({ from, to, body = '', channel = 'sms', metadata = {} }) {
    if (!from || !to) {
      throw new Error('Inbound messages require both "from" and "to" fields.');
    }
    const normalized = normalizeInboundBody(body);
    const nowIso = new Date().toISOString();
    const entry = {
      id: uuid(),
      direction: 'inbound',
      channel,
      payload: { from, to, body: normalized.body },
      status: 'queued',
      retries: 0,
      maxRetries: config.queue.maxRetries,
      offlineMode: false,
      metadata: { ...metadata, truncated: normalized.truncated },
      nextAttemptAt: Date.now(),
      createdAt: nowIso,
      updatedAt: nowIso
    };
    await this.queue.enqueue(entry);
    return entry;
  }
}

module.exports = TwilioQueueService;
