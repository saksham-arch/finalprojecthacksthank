const dayjs = require('dayjs');

class HistoryStore {
  constructor() {
    this.interactions = new Map();
  }

  recordInteraction(userId, payload) {
    if (!userId) return;
    const entry = {
      direction: payload.direction || 'outbound',
      channel: payload.channel || 'sms',
      message: payload.message || '',
      meta: payload.meta || {},
      timestamp: payload.timestamp ? dayjs(payload.timestamp).toISOString() : dayjs().toISOString(),
    };
    const existing = this.interactions.get(userId) || [];
    existing.push(entry);
    this.interactions.set(userId, existing);
    return entry;
  }

  getHistory(userId, days = 90) {
    const cutoff = dayjs().subtract(days, 'day');
    const history = this.interactions.get(userId) || [];
    return history.filter((entry) => dayjs(entry.timestamp).isAfter(cutoff));
  }
}

module.exports = { HistoryStore };
