const fs = require('fs');
const path = require('path');
const {
  MessageQueue,
  TwilioQueueService,
  QueueWorker,
  RuleEngineCache,
  OfflineController,
  OfflineDeliveryStore,
  InboundWebhookHandler
} = require('../src');

class MockTwilioClient {
  constructor() {
    this.sms = [];
    this.voice = [];
    this.networkFailuresRemaining = 0;
    this.generalFailure = false;
  }

  simulateNetworkFailure(count = 1) {
    this.networkFailuresRemaining = count;
  }

  async sendSms(payload) {
    if (this.networkFailuresRemaining > 0) {
      this.networkFailuresRemaining -= 1;
      const error = new Error('network unavailable');
      error.isNetworkError = true;
      throw error;
    }
    if (this.generalFailure) {
      throw new Error('Twilio rejected SMS');
    }
    this.sms.push(payload);
    return { sid: `SM${this.sms.length}` };
  }

  async initiateVoiceCall(payload) {
    if (this.networkFailuresRemaining > 0) {
      this.networkFailuresRemaining -= 1;
      const error = new Error('network unavailable');
      error.isNetworkError = true;
      throw error;
    }
    if (this.generalFailure) {
      throw new Error('Twilio rejected call');
    }
    this.voice.push(payload);
    return { sid: `CA${this.voice.length}` };
  }
}

const tempFiles = [];

const createTestContext = () => {
  const queueFile = path.join(
    __dirname,
    '..',
    'data',
    `queue-${Date.now()}-${Math.random().toString(16).slice(2)}.dat`
  );
  tempFiles.push(queueFile);
  const queue = new MessageQueue({ filePath: queueFile, encryptionKey: 'test-key' });
  const offlineController = new OfflineController(false);
  const offlineStore = new OfflineDeliveryStore();
  const twilioClient = new MockTwilioClient();
  const ruleEngineCache = new RuleEngineCache({ ttlMs: 1000 });
  const queueService = new TwilioQueueService({ queue, offlineController });
  const worker = new QueueWorker({
    queue,
    twilioClient,
    ruleEngineCache,
    offlineController,
    offlineStore,
    pollIntervalMs: 10
  });

  return {
    queue,
    queueFile,
    queueService,
    worker,
    twilioClient,
    offlineController,
    offlineStore,
    ruleEngineCache
  };
};

afterAll(async () => {
  await Promise.all(
    tempFiles.map(async (file) => {
      await fs.promises.rm(file, { force: true });
    })
  );
});

describe('Twilio queue pipeline', () => {
  it('delivers outbound SMS via the worker while enforcing queue semantics', async () => {
    const context = createTestContext();
    await context.queueService.enqueueOutboundMessage({
      to: '+15551234567',
      from: '+15557654321',
      body: 'Hello world'
    });

    await context.worker.processOnce();

    expect(context.twilioClient.sms).toHaveLength(1);
    const entries = await context.queue.list();
    expect(entries[0].status).toBe('succeeded');
    expect(entries[0].retries).toBe(0);
  });

  it('queues offline stubs when offline and replays them when connectivity returns', async () => {
    const context = createTestContext();
    context.offlineController.setOffline(true);

    await context.queueService.enqueueOutboundMessage({
      to: '+15551234567',
      from: '+15557654321',
      body: 'Offline delivery'
    });

    await context.worker.processOnce();

    let entries = await context.queue.list();
    expect(entries[0].status).toBe('offline_pending');
    expect(context.offlineStore.size()).toBe(1);
    expect(context.twilioClient.sms).toHaveLength(0);

    context.offlineController.setOffline(false);
    await context.worker.processOnce(Date.now() + 10_000);

    entries = await context.queue.list();
    expect(entries[0].status).toBe('succeeded');
    expect(context.twilioClient.sms).toHaveLength(1);
    expect(context.offlineStore.size()).toBe(0);
  });

  it('recovers from transient network outages and flushes pending work', async () => {
    const context = createTestContext();
    context.twilioClient.simulateNetworkFailure(1);

    await context.queueService.enqueueOutboundMessage({
      to: '+15550001111',
      from: '+15550002222',
      body: 'Network outage handling'
    });

    await context.worker.processOnce();
    let entries = await context.queue.list();
    expect(entries[0].status).toBe('offline_pending');
    expect(entries[0].retries).toBe(1);
    expect(context.offlineController.isOffline()).toBe(true);
    expect(context.twilioClient.sms).toHaveLength(0);

    context.offlineController.setOffline(false);
    await context.worker.processOnce(Date.now() + 10_000);

    entries = await context.queue.list();
    expect(entries[0].status).toBe('succeeded');
    expect(context.twilioClient.sms).toHaveLength(1);
  });

  it('persists queue state across restarts', async () => {
    const context = createTestContext();
    await context.queueService.enqueueOutboundMessage({
      to: '+15550123456',
      from: '+15550987654',
      body: 'Persist me'
    });

    const reloadedQueue = new MessageQueue({ filePath: context.queueFile, encryptionKey: 'test-key' });
    const entries = await reloadedQueue.list();

    expect(entries).toHaveLength(1);
    expect(entries[0].payload.body).toBe('Persist me');
  });

  it('responds to inbound webhook requests using cached rule-engine outputs under 3 seconds', async () => {
    const context = createTestContext();
    const handler = new InboundWebhookHandler({
      queueService: context.queueService,
      ruleEngineCache: context.ruleEngineCache
    });

    const response = await handler.handle({
      from: '+15558889999',
      to: '+15557776666',
      body: 'Inbound hello'
    });

    expect(response.statusCode).toBe(200);
    expect(response.elapsedMs).toBeLessThan(3000);

    const entries = await context.queue.list();
    expect(entries[0].direction).toBe('inbound');
    expect(entries[0].status).toBe('queued');
  });
});
