const { similarityAgainstCorpus, tokenize } = require('../utils/embedding');

const RISK_CORPUS = [
  'debt consolidation',
  'credit card refinancing',
  'investment risk tolerance',
  'leveraged equity exposure',
];

class Guardrails {
  constructor({ auditLogger, overrideRiskCorpus } = {}) {
    this.auditLogger = auditLogger;
    this.riskCorpus = overrideRiskCorpus || RISK_CORPUS;
    this.riskKeywords = ['debt', 'credit', 'loan', 'investment', 'risk'];
  }

  detectRisk(text = '') {
    const tokens = tokenize(text);
    const keywordHit = this.riskKeywords.some((keyword) => tokens.includes(keyword));
    const similarity = similarityAgainstCorpus(text, this.riskCorpus);
    const classifierFlag = similarity > 0.32;
    return {
      flagged: keywordHit || classifierFlag,
      keywordHit,
      similarity: Number(similarity.toFixed(2)),
    };
  }

  async enforce(responseText, metadata = {}) {
    const evaluation = this.detectRisk(responseText || '');
    if (!evaluation.flagged) {
      return { action: 'allow', output: responseText, evaluation };
    }
    const safeMessage =
      'For debt/credit/investment topics please consult a licensed advisor. I can continue with budgeting or cashflow guidance only.';
    if (this.auditLogger) {
      await this.auditLogger.write({
        category: 'guardrail_block',
        userId: metadata.userId,
        channel: metadata.channel,
        similarity: evaluation.similarity,
        keywordHit: evaluation.keywordHit,
        original: responseText,
      });
    }
    return { action: 'blocked', output: safeMessage, evaluation };
  }
}

module.exports = { Guardrails };
