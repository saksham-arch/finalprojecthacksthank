class OfflineDeliveryStore {
  constructor() {
    this.pending = new Map();
  }

  record(entry) {
    this.pending.set(entry.id, { ...entry });
  }

  remove(entryId) {
    this.pending.delete(entryId);
  }

  flushEntries() {
    return Array.from(this.pending.values());
  }

  size() {
    return this.pending.size;
  }

  clear() {
    this.pending.clear();
  }
}

module.exports = OfflineDeliveryStore;
