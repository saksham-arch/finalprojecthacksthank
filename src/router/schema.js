const REQUIRED_ENVELOPES = ['food', 'travel', 'bachatDabba', 'festivalPot'];
const DISCLOSURE_TYPES = ['micro-tip', 'full-breakdown'];
const SMS_CHARACTER_LIMIT = 160;

function isObject(candidate) {
  return Boolean(candidate) && typeof candidate === 'object' && !Array.isArray(candidate);
}

const budgetPlanSchema = {
  userId: 'string',
  allocations: {
    rent: { amount: 'number', currency: 'string', note: 'string' },
    envelopes: 'array',
    summary: { totalIncome: 'number', distributed: 'number', leftover: 'number', currency: 'string' }
  },
  guidance: {},
  communication: {
    sms: { locale: 'string', text: 'string' }
  },
  meta: {
    locale: 'string',
    generatedAt: 'string',
    interactionCount: 'number',
    festivalPhase: 'object',
    disclosure: 'string',
    variabilityIndex: 'number',
    consentCaptured: 'boolean',
    historyPersisted: 'boolean'
  },
  audit: {
    id: 'string',
    recordedAt: 'string'
  }
};

function validateBudgetPlan(plan) {
  const errors = [];

  if (!isObject(plan)) {
    return { valid: false, errors: ['Plan must be an object'] };
  }

  if (typeof plan.userId !== 'string' || !plan.userId.trim()) {
    errors.push('userId must be a non-empty string');
  }

  if (!isObject(plan.meta)) {
    errors.push('meta must be present');
  } else {
    const { locale, generatedAt, interactionCount, festivalPhase, disclosure, variabilityIndex, consentCaptured, historyPersisted } = plan.meta;
    if (typeof locale !== 'string') errors.push('meta.locale must be string');
    if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) errors.push('meta.generatedAt must be ISO string');
    if (typeof interactionCount !== 'number') errors.push('meta.interactionCount must be number');
    if (!isObject(festivalPhase) || typeof festivalPhase.phase !== 'string') errors.push('meta.festivalPhase must describe phase');
    if (!DISCLOSURE_TYPES.includes(disclosure)) errors.push('meta.disclosure must be a supported disclosure type');
    if (typeof variabilityIndex !== 'number') errors.push('meta.variabilityIndex must be number');
    if (typeof consentCaptured !== 'boolean') errors.push('meta.consentCaptured must be boolean');
    if (typeof historyPersisted !== 'boolean') errors.push('meta.historyPersisted must be boolean');
  }

  if (!isObject(plan.allocations)) {
    errors.push('allocations must be present');
  } else {
    const { rent, envelopes, summary } = plan.allocations;
    if (!isObject(rent) || typeof rent.amount !== 'number' || rent.amount < 0) {
      errors.push('allocations.rent must have a non-negative amount');
    }

    if (!Array.isArray(envelopes) || envelopes.length === 0) {
      errors.push('allocations.envelopes must be a non-empty array');
    } else {
      const found = new Set(envelopes.map((entry) => entry.name));
      REQUIRED_ENVELOPES.forEach((name) => {
        if (!found.has(name)) {
          errors.push(`allocations.envelopes missing ${name}`);
        }
      });
    }

    if (!isObject(summary)) {
      errors.push('allocations.summary missing');
    } else {
      ['totalIncome', 'distributed', 'leftover'].forEach((key) => {
        if (typeof summary[key] !== 'number' || summary[key] < 0) {
          errors.push(`allocations.summary.${key} must be non-negative number`);
        }
      });
      if (typeof summary.currency !== 'string') {
        errors.push('allocations.summary.currency must be string');
      }
    }
  }

  if (!isObject(plan.guidance) || typeof plan.guidance.type !== 'string') {
    errors.push('guidance.type must be provided');
  } else if (plan.guidance.type === 'micro-tip') {
    if (typeof plan.guidance.nextStep !== 'string') {
      errors.push('micro-tip guidance requires nextStep text');
    }
  } else if (plan.guidance.type === 'full-breakdown') {
    if (!Array.isArray(plan.guidance.steps) || !plan.guidance.steps.length) {
      errors.push('full-breakdown guidance requires steps');
    }
  }

  if (!isObject(plan.communication) || !isObject(plan.communication.sms)) {
    errors.push('communication.sms must be present');
  } else {
    const { locale, text } = plan.communication.sms;
    if (typeof locale !== 'string') errors.push('communication.sms.locale must be string');
    if (typeof text !== 'string') {
      errors.push('communication.sms.text must be string');
    } else {
      if (text.length > SMS_CHARACTER_LIMIT) {
        errors.push('communication.sms.text exceeds 160 characters');
      }
      if (!text.includes('➤')) {
        errors.push('communication.sms.text must use ➤ separators');
      }
    }
  }

  if (!isObject(plan.audit) || typeof plan.audit.id !== 'string') {
    errors.push('audit.id must be string');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  budgetPlanSchema,
  validateBudgetPlan,
  REQUIRED_ENVELOPES,
  DISCLOSURE_TYPES,
  SMS_CHARACTER_LIMIT
};
