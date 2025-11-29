const DEFAULT_WORDS_PER_SECOND = 3;

class BaseChannelAdapter {
  constructor({ name, queue, transport } = {}) {
    this.name = name;
    this.queue = queue;
    this.transport = transport || {
      async send() {
        return { status: 'sent', providerId: `${name || 'adapter'}-${Date.now()}` };
      },
    };
  }

  async dispatch(type, payload) {
    try {
      const response = await this.transport.send(type, payload);
      return { status: 'sent', providerResponse: response };
    } catch (error) {
      if (this.queue) {
        this.queue.enqueue({ adapter: this.name, type, payload, error: error.message });
      }
      return { status: 'queued', reason: error.message };
    }
  }

  async sendSMS({ to, body }) {
    if (!to) throw new Error('Destination number is required');
    return this.dispatch('sms', { to, body });
  }

  async sendVoiceCall({ to, script }) {
    if (!to) throw new Error('Destination number is required');
    return this.dispatch('voice', { to, script });
  }

  buildVoiceExplanationScript({ explanation, context, secondsLimit = 15 }) {
    const maxWords = Math.max(1, secondsLimit * DEFAULT_WORDS_PER_SECOND);
    const sanitized = `${explanation || ''} ${context || ''}`.trim();
    const tokens = sanitized.split(/\s+/);
    const clipped = tokens.slice(0, maxWords).join(' ');
    return clipped;
  }
}

module.exports = { BaseChannelAdapter };
