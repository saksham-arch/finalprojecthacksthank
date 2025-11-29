const { similarityAgainstCorpus, tokenize } = require('../utils/embedding');

const KEYWORD_SLOTS = {
  budget: ['budget', 'expense', 'spend', 'saving', 'category'],
  cashflow: ['cashflow', 'inflow', 'outflow', 'salary', 'rent'],
  goal: ['goal', 'dream', 'plan', 'retire', 'education'],
};

const INTENT_PROTOTYPES = {
  budget: ['help me control expenses', 'monthly budget advice', 'categorise spending'],
  cashflow: ['predict cash inflow', 'cashflow gaps', 'income timing'],
  goal: ['long term goal tracking', 'save for future goals', 'milestones for goal'],
};

class IntentExtractor {
  constructor({ keywordSlots = KEYWORD_SLOTS, prototypes = INTENT_PROTOTYPES } = {}) {
    this.keywordSlots = keywordSlots;
    this.prototypes = prototypes;
  }

  extract(text = '') {
    const keywordIntent = this.detectKeywordIntent(text);
    const classifierIntent = this.classifyIntent(text);
    const intent = keywordIntent || classifierIntent.intent || 'budget';
    const entities = this.extractEntities(text);

    return {
      intent,
      confidence: keywordIntent ? 0.92 : classifierIntent.score,
      keywordSignal: keywordIntent,
      classifierSignal: classifierIntent,
      entities,
    };
  }

  detectKeywordIntent(text) {
    const tokens = new Set(tokenize(text));
    let winningIntent = null;
    let maxHits = 0;
    Object.entries(this.keywordSlots).forEach(([intent, keywords]) => {
      let hits = 0;
      keywords.forEach((keyword) => {
        if (tokens.has(keyword)) {
          hits += 1;
        }
      });
      if (hits > maxHits) {
        winningIntent = intent;
        maxHits = hits;
      }
    });
    return winningIntent;
  }

  classifyIntent(text) {
    let bestIntent = null;
    let bestScore = 0;
    Object.entries(this.prototypes).forEach(([intent, corpus]) => {
      const score = similarityAgainstCorpus(text, corpus);
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    });
    return { intent: bestIntent, score: Number(bestScore.toFixed(2)) };
  }

  extractEntities(text = '') {
    const amounts = [];
    const amountRegex = /(rs|inr|₹)?\s?([0-9]{1,3}(?:[,\s][0-9]{3})*(?:\.[0-9]+)?)/gi;
    let match = amountRegex.exec(text);
    while (match) {
      const raw = match[0];
      const value = parseFloat(match[2].replace(/,/g, ''));
      if (!Number.isNaN(value)) {
        amounts.push({ raw, value });
      }
      match = amountRegex.exec(text);
    }

    const durationRegex = /(next|this)\s+(week|month|quarter|year)|\b\d+\s+(days|months|years)\b/gi;
    const durations = [];
    let durationMatch = durationRegex.exec(text);
    while (durationMatch) {
      durations.push(durationMatch[0]);
      durationMatch = durationRegex.exec(text);
    }

    return {
      amounts,
      durations,
    };
  }
}

module.exports = { IntentExtractor, KEYWORD_SLOTS, INTENT_PROTOTYPES };
