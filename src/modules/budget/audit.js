const { randomUUID } = require('crypto');

class AuditLogger {
  constructor() {
    this.entries = [];
  }

  log({ userId, request, response }) {
    const entry = {
      id: randomUUID(),
      userId,
      recordedAt: new Date().toISOString(),
      request,
      responseSummary: {
        allocations: response.allocations,
        guidance: response.guidance.type,
        locale: response.meta.locale
      }
    };
    this.entries.push(entry);
    return entry;
  }

  all() {
    return this.entries;
  }
}

module.exports = {
  AuditLogger
};
