const { TwilioAdapter } = require('../src/channels/twilioAdapter');
const { ExotelAdapter } = require('../src/channels/exotelAdapter');
const { LocalQueue } = require('../src/channels/localQueue');

describe('Channel adapters', () => {
  it('queues outbound SMS when provider is offline', async () => {
    const queue = new LocalQueue();
    const failingTransport = {
      send: jest.fn(() => {
        throw new Error('offline');
      }),
    };
    const adapter = new TwilioAdapter({ queue, transport: failingTransport });

    const result = await adapter.sendSMS({ to: '+100', body: 'hello' });

    expect(result.status).toBe('queued');
    expect(queue.size).toBe(1);
  });

  it('caps voice explanation scripts at 15 seconds', () => {
    const adapter = new ExotelAdapter({ queue: new LocalQueue() });
    const longExplanation = new Array(200).fill('investment').join(' ');
    const script = adapter.prepareVoiceScript({ explanation: longExplanation, context: 'context' });
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(45);
  });
});
