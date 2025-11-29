class AuditLogger {
  constructor() {
    this.entries = [];
  }

  log(event, payload = {}) {
    this.entries.push({
      id: `${event}-${this.entries.length + 1}`,
      event,
      payload,
      timestamp: new Date(),
    });
  }

  list() {
    return [...this.entries];
  }
}

module.exports = { AuditLogger };
