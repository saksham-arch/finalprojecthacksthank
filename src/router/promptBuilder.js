const { getFestivalContext } = require('../utils/festivalContext');

const SMS_LIMIT = 160;
const VOICE_WORD_LIMIT = 150;

class PromptBuilder {
  constructor({ historyStore, complianceReminders } = {}) {
    this.historyStore = historyStore;
    this.complianceReminders =
      complianceReminders || ['General education only', 'Respect DPDP consent and opt-outs'];
  }

  build({
    channelType = 'sms',
    userId,
    locale,
    history,
    festivalContext,
    complianceOverrides = [],
  } = {}) {
    const effectiveHistory = history || this.historyStore?.getHistory(userId, 90) || [];
    const serializedHistory = this.serializeHistory(effectiveHistory);
    const festival = getFestivalContext(new Date(), festivalContext);
    const compliance = [...this.complianceReminders, ...complianceOverrides].join(' | ');

    if (channelType === 'voice') {
      return this.buildVoiceContext({ serializedHistory, festival, compliance });
    }
    return this.buildSMSContext({ serializedHistory, festival, compliance });
  }

  serializeHistory(history = []) {
    if (!history.length) return 'No recent engagement';
    return history
      .slice(-3)
      .map((entry) => `${entry.direction === 'inbound' ? 'U' : 'S'}:${entry.message}`)
      .join(' | ');
  }

  buildSMSContext({ serializedHistory, festival, compliance }) {
    let context = `Hist:${serializedHistory}➤Festival:${festival}➤Compliance:${compliance}`;
    if (context.length > SMS_LIMIT) {
      context = `${context.slice(0, SMS_LIMIT - 1)}…`;
    }
    return context;
  }

  buildVoiceContext({ serializedHistory, festival, compliance }) {
    const script = `Last touchpoints: ${serializedHistory}. Festival note: ${festival}. Compliance: ${compliance}.`;
    const tokens = script.split(/\s+/);
    if (tokens.length <= VOICE_WORD_LIMIT) return script;
    return `${tokens.slice(0, VOICE_WORD_LIMIT).join(' ')} …`;
  }
}

module.exports = { PromptBuilder };
