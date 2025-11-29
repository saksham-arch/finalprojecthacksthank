class LocalQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(item) {
    this.queue.push({ ...item, enqueuedAt: new Date().toISOString() });
  }

  drain() {
    const payload = [...this.queue];
    this.queue = [];
    return payload;
  }

  get size() {
    return this.queue.length;
  }
}

module.exports = { LocalQueue };
