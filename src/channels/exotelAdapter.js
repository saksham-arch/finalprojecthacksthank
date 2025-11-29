const { BaseChannelAdapter } = require('./baseAdapter');

class ExotelAdapter extends BaseChannelAdapter {
  constructor(options = {}) {
    super({ name: 'exotel', ...options });
  }

  receiveSMS(payload) {
    return {
      from: payload.from,
      to: payload.to,
      message: payload.message,
      channel: 'sms',
    };
  }

  receiveVoice(payload) {
    return {
      from: payload.callerId,
      to: payload.virtualNumber,
      transcript: payload.transcript,
      channel: 'voice',
    };
  }

  prepareVoiceScript({ explanation, context }) {
    return this.buildVoiceExplanationScript({ explanation, context, secondsLimit: 15 });
  }
}

module.exports = { ExotelAdapter };
