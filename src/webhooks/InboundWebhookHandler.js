class InboundWebhookHandler {
  constructor({ queueService, ruleEngineCache }) {
    this.queueService = queueService;
    this.ruleEngineCache = ruleEngineCache;
  }

  async handle(payload) {
    const start = Date.now();
    const cachedResponse = this.ruleEngineCache.getOrPrime(payload);
    await this.queueService.enqueueInboundMessage({
      from: payload.from,
      to: payload.to,
      body: payload.body,
      channel: payload.channel,
      metadata: {
        ...(payload.metadata || {}),
        cachedResponse
      }
    });

    const elapsedMs = Date.now() - start;

    return {
      statusCode: 200,
      body: cachedResponse,
      elapsedMs
    };
  }
}

module.exports = InboundWebhookHandler;
