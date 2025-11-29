const { BaseChannelAdapter } = require('./baseAdapter');

class TwilioAdapter extends BaseChannelAdapter {
  constructor(options = {}) {
    super({ name: 'twilio', ...options });
  }

  receiveSMS(payload) {
    return {
      from: payload.From,
      to: payload.To,
      message: payload.Body,
      channel: 'sms',
    };
  }

  receiveVoice(payload) {
    return {
      from: payload.From,
      to: payload.To,
      transcript: payload.TranscriptionText,
      channel: 'voice',
    };
  }

  prepareVoiceScript({ explanation, context }) {
    return this.buildVoiceExplanationScript({ explanation, context, secondsLimit: 15 });
  }
}

module.exports = { TwilioAdapter };
