const { deriveEnvelopeWeights, REQUIRED_ENVELOPES } = require('./envelopes');
const { describeFestivalPhase, DEFAULT_FESTIVALS } = require('./calendar');
const { formatSms } = require('./localization');
const { AuditLogger } = require('./audit');
const { PlanHistoryStore } = require('./history');
const { validateBudgetPlan } = require('../../router/schema');

function safeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function friendlyName(envelopeName) {
  switch (envelopeName) {
    case 'food':
      return 'roti dabba';
    case 'travel':
      return 'safar coins';
    case 'bachatDabba':
      return 'bachat dabba';
    case 'festivalPot':
      return 'festival pot';
    default:
      return envelopeName;
  }
}

function formatCurrency(amount) {
  return `₹${Math.round(amount)}`;
}

class BudgetPlanner {
  constructor(options = {}) {
    this.historyStore = options.historyStore || new PlanHistoryStore();
    this.auditLogger = options.auditLogger || new AuditLogger();
    this.festivalCalendar = options.festivalCalendar || DEFAULT_FESTIVALS;
    this.currency = 'INR';
  }

  resolveFestivalPhase(date) {
    const calendar = this.festivalCalendar;

    if (calendar && typeof calendar.describePhase === 'function') {
      return calendar.describePhase(date);
    }

    if (calendar && typeof calendar.getFestivals === 'function') {
      return describeFestivalPhase(date, calendar.getFestivals());
    }

    if (typeof calendar === 'function') {
      const result = calendar(date);
      if (Array.isArray(result)) {
        return describeFestivalPhase(date, result);
      }
      if (result && typeof result.phase === 'string') {
        return result;
      }
    }

    if (Array.isArray(calendar)) {
      return describeFestivalPhase(date, calendar);
    }

    return describeFestivalPhase(date, DEFAULT_FESTIVALS);
  }

  plan(payload = {}) {
    const normalized = this.normalizePayload(payload);
    const plan = this.buildPlan(normalized);
    const validation = validateBudgetPlan(plan);

    if (!validation.valid) {
      const error = new Error('Budget plan failed router schema validation');
      error.validationErrors = validation.errors;
      throw error;
    }

    return plan;
  }

  normalizePayload(payload) {
    const date = payload.date ? new Date(payload.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid date provided');
    }

    return {
      userId: payload.userId || 'anonymous-user',
      income: safeNumber(payload.income, 0),
      rentDue: safeNumber(payload.rentDue, 0),
      interactionCount: typeof payload.interactionCount === 'number' ? payload.interactionCount : 1,
      incomeHistory: Array.isArray(payload.incomeHistory) ? payload.incomeHistory : [],
      locale: payload.locale || 'en',
      consent: payload.consent || {},
      date
    };
  }

  buildPlan(input) {
    const festivalPhase = this.resolveFestivalPhase(input.date);
    const rentAmount = this.calculateRentAllocation(input.income, input.rentDue);
    const envelopes = this.allocateEnvelopes({
      income: input.income,
      rentAmount,
      incomeHistory: input.incomeHistory,
      festivalPhase
    });

    const totalIncome = input.income;
    const distributed = rentAmount + envelopes.total;
    const leftover = Math.max(totalIncome - distributed, 0);

    const guidance = this.buildGuidance({
      interactionCount: input.interactionCount,
      envelopes: envelopes.items,
      festivalPhase
    });

    const sms = formatSms({
      locale: input.locale,
      allocations: {
        rent: { amount: rentAmount },
        envelopes: envelopes.items
      }
    });

    const plan = {
      userId: input.userId,
      allocations: {
        rent: {
          amount: rentAmount,
          currency: this.currency,
          note: rentAmount === 3000 ? 'Rent capped at ₹3,000' : 'Rent fully covered first'
        },
        envelopes: envelopes.items,
        summary: {
          currency: this.currency,
          totalIncome,
          distributed,
          leftover
        }
      },
      guidance,
      communication: {
        sms
      },
      meta: {
        locale: input.locale,
        generatedAt: new Date().toISOString(),
        interactionCount: input.interactionCount,
        festivalPhase,
        disclosure: guidance.type,
        variabilityIndex: envelopes.variability,
        consentCaptured: Boolean(input.consent.dpdp === true),
        historyPersisted: false
      },
      audit: {
        id: null,
        recordedAt: null
      }
    };

    const auditEntry = this.auditLogger.log({
      userId: input.userId,
      request: {
        income: input.income,
        rentDue: input.rentDue,
        interactionCount: input.interactionCount,
        locale: input.locale,
        consentGranted: Boolean(input.consent.dpdp === true)
      },
      response: plan
    });

    plan.audit = { id: auditEntry.id, recordedAt: auditEntry.recordedAt };

    if (plan.meta.consentCaptured) {
      this.historyStore.persist(input.userId, plan);
      plan.meta.historyPersisted = true;
    }

    return plan;
  }

  calculateRentAllocation(income, rentDue) {
    const rent = Math.min(Math.max(rentDue, 0), 3000);
    return Math.min(rent, Math.max(income, 0));
  }

  allocateEnvelopes({ income, rentAmount, incomeHistory, festivalPhase }) {
    const pool = Math.max(income - rentAmount, 0);
    const { weights, variability } = deriveEnvelopeWeights({ incomeHistory, festivalPhase });

    const items = [];
    let allocated = 0;

    REQUIRED_ENVELOPES.forEach((envelopeName, index) => {
      let amount;
      if (index === REQUIRED_ENVELOPES.length - 1) {
        amount = Math.max(pool - allocated, 0);
      } else {
        amount = Math.floor(pool * weights[envelopeName]);
      }
      allocated += amount;
      items.push({
        name: envelopeName,
        amount,
        currency: this.currency,
        note: this.describeEnvelope(envelopeName, festivalPhase)
      });
    });

    return { items, total: allocated, variability };
  }

  describeEnvelope(envelopeName, festivalPhase) {
    const baseNotes = {
      food: 'Roti dabba for steady meals',
      travel: 'Bus/rickshaw coins for travel',
      bachatDabba: 'Gullak savings for shocks',
      festivalPot: 'Festival pot for rituals'
    };

    let note = baseNotes[envelopeName] || 'Essential pot';

    if (festivalPhase.phase === 'pre' && (envelopeName === 'bachatDabba' || envelopeName === 'festivalPot')) {
      note += ` boosted for ${festivalPhase.festival}`;
    }

    if (festivalPhase.phase === 'post' && envelopeName === 'food') {
      note += ' relaxed after celebrations';
    }

    return note;
  }

  buildGuidance({ interactionCount, envelopes, festivalPhase }) {
    if (interactionCount <= 5) {
      const topEnvelope = envelopes.reduce((prev, current) => (current.amount > prev.amount ? current : prev), envelopes[0]);
      return {
        type: 'micro-tip',
        nextStep: `Drop ${formatCurrency(topEnvelope.amount)} into ${friendlyName(topEnvelope.name)} now`,
        context: festivalPhase.phase === 'pre' ? 'Festival build-up focus' : 'Daily stability focus'
      };
    }

    return {
      type: 'full-breakdown',
      steps: envelopes.map((envelope) => ({
        envelope: envelope.name,
        directive: `Keep ${formatCurrency(envelope.amount)} in the ${friendlyName(envelope.name)}`
      })),
      summary: festivalPhase.phase === 'post'
        ? 'Relax pots post celebration but keep savings steady'
        : 'Balance pots with emphasis on future festivals'
    };
  }
}

module.exports = BudgetPlanner;
