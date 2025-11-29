const {
  SMS_MAX_LENGTH,
  VOICE_WORD_LIMIT,
  VOICE_MAX_DURATION_SECONDS
} = require('./constants');

function formatSmsMessage(text) {
  const sanitized = text
    .replace(/\s+/g, ' ')
    .replace(/["\n\r\t]/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim();

  if (sanitized.length <= SMS_MAX_LENGTH) {
    return sanitized;
  }
  return `${sanitized.slice(0, SMS_MAX_LENGTH - 3)}...`;
}

function buildGapSmsMessage({ total48h, threshold }) {
  const roundedTotal = Math.round(total48h);
  const shortfall = Math.max(0, Math.round(threshold - total48h));
  const baseMessage = `Low cashflow alert: Only INR ${roundedTotal} expected next 48h, short by INR ${shortfall}. Boost gigs or dip into savings and we'll send options soon.`;
  return formatSmsMessage(baseMessage);
}

function trimToWordLimit(text, limit) {
  const words = text
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= limit) {
    return {
      text: words.join(' '),
      wordCount: words.length
    };
  }

  return {
    text: words.slice(0, limit).join(' '),
    wordCount: limit
  };
}

function buildVoiceSummaryPayload({ total48h, predictions }) {
  const dayOne = predictions[0] ? Math.round(predictions[0].amount) : 0;
  const dayTwo = predictions[1] ? Math.round(predictions[1].amount) : 0;
  const roundedTotal = Math.round(total48h);
  const baseScript = `Income alert. Next forty eight hours look light, with about ${dayOne} rupees today and ${dayTwo} tomorrow, totaling ${roundedTotal}. Try peak slots or backup funds. We'll check again soon.`;
  const { text, wordCount } = trimToWordLimit(baseScript, VOICE_WORD_LIMIT);
  const durationSeconds = Math.min(
    VOICE_MAX_DURATION_SECONDS,
    parseFloat((wordCount / 2.5).toFixed(1))
  );

  return {
    script: text,
    durationSeconds,
    wordCount
  };
}

module.exports = {
  formatSmsMessage,
  buildGapSmsMessage,
  buildVoiceSummaryPayload
};
