class RuleEngineCache {
  constructor({ ttlMs = 60_000 } = {}) {
    this.ttlMs = ttlMs;
    this.cache = new Map();
  }

  _cacheKey(payload) {
    return `${payload.from || ''}:${payload.to || ''}`;
  }

  prime(payload, response) {
    const key = this._cacheKey(payload);
    this.cache.set(key, {
      response,
      expiresAt: Date.now() + this.ttlMs
    });
    return response;
  }

  get(payload) {
    const key = this._cacheKey(payload);
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return cached.response;
  }

  buildResponse(payload) {
    return {
      message: `Cached acknowledgement for ${payload.from || 'unknown sender'}`,
      to: payload.from,
      from: payload.to
    };
  }

  getOrPrime(payload) {
    return this.get(payload) || this.prime(payload, this.buildResponse(payload));
  }

  async processInboundResult(entry) {
    // Simulate an expensive rule-engine evaluation that eventually refreshes the cache.
    const response = {
      message: `Rule-engine processed ${entry.payload.from}`,
      to: entry.payload.from,
      from: entry.payload.to,
      correlationId: entry.id
    };
    this.prime(entry.payload, response);
    return response;
  }
}

module.exports = RuleEngineCache;
