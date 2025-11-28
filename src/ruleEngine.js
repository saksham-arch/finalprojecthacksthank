'use strict';

const RULE_VERSION = '2024.11-r1';
const SMS_LIMIT = 160;
const SUPPORTED_LANGUAGES = ['en', 'hi', 'ta'];
const LANGUAGE_LABELS = {
  en: 'English',
  hi: 'हिंदी',
  ta: 'தமிழ்'
};

const DEFAULT_STATE = {
  userId: null,
  rentDue: 0,
  income: 0,
  savings: 0,
  savingsBuffer: 0,
  goals: [],
  festivals: {},
  languagePreference: 'en',
  autoDetectedLanguages: [],
  dpdpNoticeVersionAck: null,
  offlineSince: null,
  safetyFlags: {
    blockTransfers: false
  },
  financial_state: {}
};

const MESSAGE_TEMPLATES = {
  en: {
    bootstrap: 'Hi {name}, rent ₹{rentDue} secured and savings ₹{savings} primed.',
    income: 'Income ₹{income} logged. Rent ₹{rentPaid}, saved ₹{saved}.',
    festival: '{festival} boost {multiplier}x applied. Rent ₹{rentDue}, savings ₹{savings}.',
    offline: 'Offline safe stub since {offlineSince}. Rent ₹{rentDue}, buffer ₹{buffer}.',
    dpdp: 'DPDP v{notice} noted. Rent ₹{rentDue}, savings ₹{savings}.',
    safety: 'Safety {action} on. Transfers {transfers}. Rent ₹{rentDue}.',
    multilingual: '{languageLabel} reply active. Goal {goalName} at {goalProgress}% and rent ₹{rentDue}.',
    performance: 'Cost {cost} ops, budget {budget}ms {status}. Rent ₹{rentDue}, savings ₹{savings}.'
  },
  hi: {
    bootstrap: 'नमस्ते {name}, किराया ₹{rentDue} सुरक्षित और बचत ₹{savings} तय.',
    income: 'आय ₹{income} दर्ज. किराया ₹{rentPaid}, बचत ₹{saved}.',
    festival: '{festival} गुणक {multiplier}x लागू. किराया ₹{rentDue}, बचत ₹{savings}.',
    offline: 'ऑफ़लाइन {offlineSince} से सुरक्षित. किराया ₹{rentDue}, बफर ₹{buffer}.',
    dpdp: 'डीपीडीपी v{notice} स्वीकार. किराया ₹{rentDue}, बचत ₹{savings}.',
    safety: 'सुरक्षा {action} चालू. ट्रांसफ़र {transfers}. किराया ₹{rentDue}.',
    multilingual: '{languageLabel} जवाब सक्रिय. लक्ष्य {goalName} {goalProgress}% पर.',
    performance: 'लागत {cost} ऑप्स, बजट {budget}ms {status}. किराया ₹{rentDue}.'
  },
  ta: {
    bootstrap: 'வணக்கம் {name}, வாடகை ₹{rentDue} பாதுகாப்பு, சேமிப்பு ₹{savings}.',
    income: 'வருவாய் ₹{income}. வாடகை ₹{rentPaid}, சேமிப்பு ₹{saved}.',
    festival: '{festival} {multiplier}x பல்கூறு. வாடகை ₹{rentDue}, சேமிப்பு ₹{savings}.',
    offline: '{offlineSince} முதல் ஆஃப்லைன் பாதுகாப்பு. வாடகை ₹{rentDue}, இடைநிலை ₹{buffer}.',
    dpdp: 'DPDP v{notice} ஏற்றுக்கொண்டோம். வாடகை ₹{rentDue}, சேமிப்பு ₹{savings}.',
    safety: 'பாதுகாப்பு {action} இயக்கு. பரிமாற்றம் {transfers}.',
    multilingual: '{languageLabel} பதில். இலக்கு {goalName} {goalProgress}% நிலை.',
    performance: '{cost} செயல்கள், பட்ஜெட் {budget}ms {status}. வாடகை ₹{rentDue}.'
  }
};

const SCENARIO_TEMPLATE_MAP = {
  bootstrap: 'bootstrap',
  income: 'income',
  festival: 'festival',
  offline: 'offline',
  dpdp: 'dpdp',
  safety: 'safety',
  multilingual: 'multilingual',
  performance: 'performance'
};

function runRuleEngine(options = {}) {
  const {
    financialState = {},
    metadata = {},
    event = {},
    context = {},
    config = {}
  } = options;

  let auditTrail = [];

  const integration = integrateMetadata(financialState, metadata);
  let state = integration.state;
  auditTrail.push(integration.audit);

  const scenario = event.type || 'income';
  const incomeAmount = toNumber(event.amount ?? event.income ?? event.bootstrapIncome);
  const shouldAllocateRent = ['bootstrap', 'income', 'multilingual', 'performance'].includes(scenario) || incomeAmount > 0;

  let rentAllocation = null;
  let festivalData = null;
  let offlineData = null;
  let dpdpData = null;
  let safetyData = null;

  if (shouldAllocateRent) {
    const rentResult = rentFirstAllocation(state, {
      income: incomeAmount,
      rentDue: event.rentDue
    });
    state = rentResult.state;
    rentAllocation = rentResult;
    auditTrail.push(rentResult.audit);
  }

  if (scenario === 'festival') {
    const festivalResult = applyFestivalMultiplier(state, event.festivalId, metadata);
    state = festivalResult.state;
    festivalData = festivalResult.data;
    auditTrail.push(festivalResult.audit);
  }

  if (scenario === 'offline') {
    const offlineResult = markOfflineStub(state, event);
    state = offlineResult.state;
    offlineData = offlineResult.data;
    auditTrail.push(offlineResult.audit);
  }

  if (scenario === 'dpdp') {
    const dpdpResult = acknowledgeDpdp(state, event);
    state = dpdpResult.state;
    dpdpData = dpdpResult.data;
    auditTrail.push(dpdpResult.audit);
  }

  if (scenario === 'safety') {
    const safetyResult = enforceSafety(state, event);
    state = safetyResult.state;
    safetyData = safetyResult.data;
    auditTrail.push(safetyResult.audit);
  }

  const savingsResult = trackSavings(state);
  state = savingsResult.state;
  auditTrail.push(savingsResult.audit);

  const goalResult = computeGoalProgress(state);
  state = goalResult.state;
  auditTrail.push(goalResult.audit);

  const performanceResult = enforcePerformanceBudget(state, config, event);
  state = performanceResult.state;
  auditTrail.push(performanceResult.audit);

  const languageResult = determineLanguage(state, { event, context });
  auditTrail.push(languageResult.audit);

  const responseResult = generateResponse({
    scenario,
    language: languageResult.language,
    state,
    event,
    rentAllocation,
    festivalData,
    offlineData,
    dpdpData,
    safetyData,
    goalProgress: goalResult.progress,
    savingsStats: savingsResult.stats,
    performanceData: performanceResult
  });
  auditTrail.push(responseResult.audit);

  return {
    nextState: state,
    response: responseResult.payload,
    auditTrail
  };
}

function integrateMetadata(stateInput = {}, metadata = {}) {
  const base = cloneDeep(DEFAULT_STATE);
  const incoming = cloneDeep(stateInput || {});
  const clonedState = {
    ...base,
    ...incoming,
    financial_state: {
      ...base.financial_state,
      ...(incoming.financial_state || {})
    }
  };

  const goalMetadata = metadata.goalMetadata || [];
  const festivalMetadata = metadata.festivalMetadata || {};

  const existingGoals = clonedState.financial_state.goals || clonedState.goals || [];
  const existingFestivals = clonedState.financial_state.festivals || clonedState.festivals || {};

  const mergedGoals = mergeGoals(existingGoals, goalMetadata);
  const mergedFestivals = mergeFestivals(existingFestivals, festivalMetadata);

  clonedState.goals = mergedGoals;
  clonedState.festivals = mergedFestivals;
  clonedState.financial_state = {
    ...clonedState.financial_state,
    goals: mergedGoals,
    festivals: mergedFestivals,
    languagePreference: clonedState.languagePreference
  };

  const audit = createAuditRow('metadata_integration', {
    incomingGoals: goalMetadata.length,
    incomingFestivals: Object.keys(festivalMetadata).length,
    preferredLanguage: clonedState.languagePreference
  }, {
    goalCount: mergedGoals.length,
    festivalCount: Object.keys(mergedFestivals).length
  });

  return { state: clonedState, audit };
}

function mergeGoals(existingGoals, metadataGoals) {
  const map = new Map();
  (existingGoals || []).forEach(goal => {
    map.set(goal.id, {
      id: goal.id,
      name: goal.name || goal.id,
      targetAmount: toNumber(goal.targetAmount),
      savedAmount: toNumber(goal.savedAmount),
      priority: toNumber(goal.priority ?? 999),
      category: goal.category || 'general'
    });
  });
  (metadataGoals || []).forEach(goal => {
    const current = map.get(goal.id) || {};
    map.set(goal.id, {
      id: goal.id,
      name: goal.name || current.name || goal.id,
      targetAmount: toNumber(goal.targetAmount ?? current.targetAmount),
      savedAmount: toNumber(current.savedAmount ?? goal.savedAmount),
      priority: toNumber(goal.priority ?? current.priority ?? 999),
      category: goal.category || current.category || 'general'
    });
  });
  return Array.from(map.values())
    .map(goal => ({
      ...goal,
      savedAmount: Math.min(goal.savedAmount, goal.targetAmount)
    }))
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.id.localeCompare(b.id);
    });
}

function mergeFestivals(existingFestivals, metadataFestivals) {
  const merged = { ...existingFestivals };
  Object.entries(metadataFestivals || {}).forEach(([festivalId, details]) => {
    const previous = merged[festivalId] || {};
    merged[festivalId] = {
      id: festivalId,
      name: details.name || previous.name || festivalId,
      multiplier: toNumber(details.multiplier ?? previous.multiplier ?? 1),
      budgetImpact: toNumber(details.budgetImpact ?? previous.budgetImpact ?? 0)
    };
  });
  return merged;
}

function rentFirstAllocation(stateInput, payload = {}) {
  const state = cloneDeep(stateInput);
  const rentDue = payload.rentDue !== undefined ? toNumber(payload.rentDue) : toNumber(state.rentDue);
  const income = toNumber(payload.income);
  const normalizedRentDue = Math.max(rentDue, 0);
  const normalizedIncome = Math.max(income, 0);
  const rentPaid = Math.min(normalizedRentDue, normalizedIncome);
  const remainingAfterRent = normalizedIncome - rentPaid;

  const allocation = allocateSavings(state.goals || [], remainingAfterRent);

  state.rentDue = roundToTwo(normalizedRentDue - rentPaid);
  state.income = roundToTwo(toNumber(state.income) + normalizedIncome);
  state.savings = roundToTwo(toNumber(state.savings) + remainingAfterRent);
  state.savingsBuffer = roundToTwo(toNumber(state.savingsBuffer) + allocation.leftover);
  state.goals = allocation.goals;
  if (!state.financial_state || typeof state.financial_state !== 'object') {
    state.financial_state = {};
  }
  state.financial_state.goals = allocation.goals;

  const audit = createAuditRow('rent_first_allocation', {
    income: normalizedIncome,
    rentDue: normalizedRentDue
  }, {
    rentPaid: rentPaid,
    saved: remainingAfterRent,
    goalDistribution: allocation.distribution
  });

  return {
    state,
    audit,
    allocation: {
      rentPaid,
      saved: remainingAfterRent,
      goalDistribution: allocation.distribution
    }
  };
}

function allocateSavings(goals, amount) {
  const updatedGoals = (goals || []).map(goal => ({ ...goal }));
  let remaining = amount;
  const distribution = {};
  updatedGoals.forEach(goal => {
    if (remaining <= 0) {
      return;
    }
    const need = Math.max(goal.targetAmount - goal.savedAmount, 0);
    if (need <= 0) {
      return;
    }
    const contribution = Math.min(need, remaining);
    goal.savedAmount = roundToTwo(goal.savedAmount + contribution);
    distribution[goal.id] = roundToTwo(contribution);
    remaining -= contribution;
  });
  return {
    goals: updatedGoals,
    leftover: roundToTwo(remaining),
    distribution
  };
}

function trackSavings(stateInput) {
  const state = cloneDeep(stateInput);
  const goalTargetTotal = (state.goals || []).reduce((sum, goal) => sum + toNumber(goal.targetAmount), 0);
  const goalSavedTotal = (state.goals || []).reduce((sum, goal) => sum + toNumber(goal.savedAmount), 0);
  const ratio = goalTargetTotal > 0 ? roundToTwo((goalSavedTotal / goalTargetTotal) * 100) : 0;
  const health = ratio >= 75 ? 'on-track' : ratio >= 40 ? 'building' : 'warming';

  state.savingsProgressPercent = ratio;
  state.savingsHealth = health;

  const audit = createAuditRow('savings_tracking', {
    goalTargetTotal,
    goalSavedTotal
  }, {
    ratio,
    health
  });

  return {
    state,
    audit,
    stats: {
      ratio,
      health
    }
  };
}

function applyFestivalMultiplier(stateInput, festivalId, metadata = {}) {
  const state = cloneDeep(stateInput);
  if (!state.financial_state || typeof state.financial_state !== 'object') {
    state.financial_state = {};
  }
  const existingFestivals = state.festivals || {};
  const metadataFestivals = metadata.festivalMetadata || {};
  const resolvedId = festivalId || Object.keys(existingFestivals)[0] || Object.keys(metadataFestivals)[0] || 'general';
  const festivalRecord = existingFestivals[resolvedId] || metadataFestivals[resolvedId] || { multiplier: 1, budgetImpact: 0, name: resolvedId };
  const multiplier = toNumber(festivalRecord.multiplier) || 1;
  const budgetImpact = toNumber(festivalRecord.budgetImpact) || 0;
  const adjustedRent = roundToTwo(toNumber(state.rentDue) * multiplier);

  const normalizedFestival = {
    ...festivalRecord,
    id: resolvedId,
    multiplier,
    budgetImpact
  };

  const updatedFestivals = {
    ...existingFestivals,
    [resolvedId]: normalizedFestival
  };

  state.festivals = updatedFestivals;
  state.financial_state.festivals = updatedFestivals;
  state.rentDue = adjustedRent;

  const audit = createAuditRow('festival_multiplier', {
    festivalId: resolvedId,
    multiplier,
    budgetImpact
  }, {
    rentDue: adjustedRent
  });

  return {
    state,
    audit,
    data: {
      id: resolvedId,
      name: normalizedFestival.name || resolvedId,
      multiplier: roundToTwo(multiplier),
      budgetImpact
    }
  };
}

function computeGoalProgress(stateInput) {
  const state = cloneDeep(stateInput);
  const progress = (state.goals || []).map(goal => ({
    id: goal.id,
    name: goal.name,
    progressPercent: goal.targetAmount > 0 ? roundToTwo((goal.savedAmount / goal.targetAmount) * 100) : 0
  }));
  state.goalProgress = progress;
  const audit = createAuditRow('goal_progress', {
    goalCount: progress.length
  }, {
    progress
  });
  return {
    state,
    audit,
    progress
  };
}

function markOfflineStub(stateInput, event = {}) {
  const state = cloneDeep(stateInput);
  const offlineSince = event.offlineSince || 'pending-sync';
  state.offlineSince = offlineSince;
  const audit = createAuditRow('offline_stub', {
    offlineSince
  }, {
    offlineSince
  });
  return {
    state,
    audit,
    data: {
      offlineSince
    }
  };
}

function acknowledgeDpdp(stateInput, event = {}) {
  const state = cloneDeep(stateInput);
  const noticeVersion = event.noticeVersion || event.version || 'unspecified';
  state.dpdpNoticeVersionAck = noticeVersion;
  const audit = createAuditRow('dpdp_notice', {
    noticeVersion
  }, {
    ack: noticeVersion
  });
  return {
    state,
    audit,
    data: {
      noticeVersion
    }
  };
}

function enforceSafety(stateInput, event = {}) {
  const state = cloneDeep(stateInput);
  const flag = event.flag || 'blockTransfers';
  const enforced = event.value !== undefined ? Boolean(event.value) : true;
  state.safetyFlags = {
    ...(state.safetyFlags || {}),
    [flag]: enforced
  };
  const audit = createAuditRow('safety_hook', {
    flag,
    enforced
  }, {
    safetyFlags: state.safetyFlags
  });
  return {
    state,
    audit,
    data: {
      flag,
      enforced
    }
  };
}

function enforcePerformanceBudget(stateInput, config = {}, event = {}) {
  const state = cloneDeep(stateInput);
  const configuredBudget = toNumber(config.performanceBudgetMs);
  const hasBudget = Number.isFinite(configuredBudget) && configuredBudget > 0;
  const estimatedCost = estimateCost(state, event);
  const constrained = hasBudget ? estimatedCost > configuredBudget : false;
  if (constrained) {
    state.performanceTrimmed = true;
  }
  const budget = hasBudget ? configuredBudget : estimatedCost;
  const audit = createAuditRow('performance_budget', {
    budget,
    estimatedCost
  }, {
    constrained
  });
  return {
    state,
    audit,
    estimatedCost,
    budget,
    constrained
  };
}

function estimateCost(state, event) {
  const goalFactor = ((state.goals || []).length) * 2;
  const festivalFactor = Object.keys(state.festivals || {}).length;
  const eventFactor = Math.max(toNumber(event.complexity), 1);
  return goalFactor + festivalFactor + eventFactor;
}

function determineLanguage(stateInput, { event = {}, context = {} } = {}) {
  const candidates = [
    event.language,
    context.languagePreference,
    stateInput.languagePreference,
    ...(event.autoDetectedLanguages || []),
    ...(context.autoDetectedLanguages || []),
    ...(stateInput.autoDetectedLanguages || [])
  ].filter(Boolean);

  let resolved = 'en';
  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) {
      resolved = normalized;
      break;
    }
  }

  const audit = createAuditRow('language_selection', {
    candidates
  }, {
    language: resolved
  });

  return {
    language: resolved,
    audit
  };
}

function normalizeLanguage(language) {
  if (!language) {
    return null;
  }
  const normalized = String(language).toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : null;
}

function generateResponse({
  scenario,
  language,
  state,
  event,
  rentAllocation,
  festivalData,
  offlineData,
  dpdpData,
  safetyData,
  goalProgress,
  savingsStats,
  performanceData
}) {
  const templateKey = SCENARIO_TEMPLATE_MAP[scenario] || 'income';
  const values = buildTemplateValues({
    state,
    event,
    rentAllocation,
    festivalData,
    offlineData,
    dpdpData,
    safetyData,
    goalProgress,
    savingsStats,
    performanceData,
    language
  });

  const templateResult = formatTemplate(language, templateKey, values);

  const audit = createAuditRow('response_render', {
    language,
    templateKey,
    values
  }, {
    message: templateResult.message,
    truncated: templateResult.truncated
  });

  return {
    payload: {
      language,
      message: templateResult.message,
      truncated: templateResult.truncated
    },
    audit
  };
}

function buildTemplateValues({
  state,
  event,
  rentAllocation,
  festivalData,
  offlineData,
  dpdpData,
  safetyData,
  goalProgress,
  savingsStats,
  performanceData,
  language
}) {
  const primaryGoal = (goalProgress || [])[0] || { name: 'goal', progressPercent: 0 };
  return {
    name: event.name || 'friend',
    rentDue: formatCurrency(state.rentDue),
    savings: formatCurrency(state.savings),
    income: formatCurrency((event.amount ?? event.income ?? 0)),
    rentPaid: formatCurrency(rentAllocation?.allocation?.rentPaid ?? 0),
    saved: formatCurrency(rentAllocation?.allocation?.saved ?? 0),
    festival: festivalData?.name || event.festivalId || 'festival',
    multiplier: toNumber(festivalData?.multiplier) || 1,
    offlineSince: offlineData?.offlineSince || state.offlineSince || 'pending',
    buffer: formatCurrency(state.savingsBuffer),
    notice: dpdpData?.noticeVersion || state.dpdpNoticeVersionAck || 'pending',
    action: safetyData?.flag || 'blockTransfers',
    transfers: safetyData?.enforced ? 'paused' : 'open',
    languageLabel: LANGUAGE_LABELS[language] || LANGUAGE_LABELS.en,
    goalName: primaryGoal.name,
    goalProgress: primaryGoal.progressPercent,
    cost: performanceData?.estimatedCost ?? 0,
    budget: performanceData?.budget ?? 0,
    status: performanceData?.constrained ? 'trimmed' : 'met'
  };
}

function formatTemplate(language, key, values) {
  const templates = MESSAGE_TEMPLATES[language] || MESSAGE_TEMPLATES.en;
  const template = templates[key] || MESSAGE_TEMPLATES.en[key] || MESSAGE_TEMPLATES.en.income;
  const icuSafeValues = Object.keys(values || {}).reduce((acc, currentKey) => {
    acc[currentKey] = encodeIcu(values[currentKey]);
    return acc;
  }, {});
  const compiled = template.replace(/\{(\w+)\}/g, (_, token) => {
    return icuSafeValues[token] !== undefined ? icuSafeValues[token] : '';
  });
  const limited = enforceSmsLimit(compiled);
  return limited;
}

function encodeIcu(value) {
  return String(value ?? '')
    .replace(/\{/g, '\u007B')
    .replace(/\}/g, '\u007D');
}

function enforceSmsLimit(message) {
  if (message.length <= SMS_LIMIT) {
    return { message, truncated: false };
  }
  return {
    message: message.slice(0, SMS_LIMIT - 3) + '...',
    truncated: true
  };
}

function createAuditRow(rule, inputs, outputs) {
  return {
    rule,
    version: RULE_VERSION,
    inputs: cloneDeep(inputs),
    outputs: cloneDeep(outputs)
  };
}

function cloneDeep(value) {
  if (value === undefined) {
    return null;
  }
  return JSON.parse(JSON.stringify(value));
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatCurrency(value) {
  const amount = roundToTwo(toNumber(value));
  if (Number.isNaN(amount)) {
    return '0';
  }
  return amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
}

module.exports = {
  runRuleEngine,
  rentFirstAllocation,
  trackSavings,
  applyFestivalMultiplier,
  computeGoalProgress,
  determineLanguage,
  RULE_VERSION
};
