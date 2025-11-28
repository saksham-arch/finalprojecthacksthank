const test = require('node:test');
const assert = require('node:assert');

const { runRuleEngine, RULE_VERSION } = require('../src/ruleEngine');

function expectAuditRule(result, ruleName) {
  assert.ok(result.auditTrail.some(row => row.rule === ruleName), `Expected audit rule ${ruleName}`);
}

function expectSmsLimit(message) {
  assert.ok(message.length <= 160, `SMS limit exceeded: ${message.length}`);
}

test('new user bootstrap scenario produces deterministic rent-first allocation', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 8000,
      savings: 0
    },
    metadata: {
      goalMetadata: [{ id: 'emergency', name: 'Emergency', targetAmount: 10000, priority: 1 }]
    },
    event: {
      type: 'bootstrap',
      income: 12000,
      name: 'Asha'
    },
    context: {
      languagePreference: 'hi'
    }
  });

  assert.strictEqual(result.response.language, 'hi');
  assert.strictEqual(result.response.message, 'नमस्ते Asha, किराया ₹0 सुरक्षित और बचत ₹4000 तय.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'rent_first_allocation');
  assert.strictEqual(result.nextState.financial_state.goals[0].savedAmount, 4000);
  assert.ok(result.auditTrail.every(row => row.version === RULE_VERSION));
});

test('income logging scenario keeps rent-first strategy and audits savings', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 5000,
      savings: 1000,
      goals: [{ id: 'travel', name: 'Travel', targetAmount: 2000, savedAmount: 200 }],
      languagePreference: 'en'
    },
    metadata: {
      goalMetadata: [
        { id: 'travel', name: 'Travel', targetAmount: 2000, priority: 1 },
        { id: 'college', name: 'College', targetAmount: 5000, priority: 2 }
      ]
    },
    event: {
      type: 'income',
      amount: 6000
    }
  });

  assert.strictEqual(result.response.message, 'Income ₹6000 logged. Rent ₹5000, saved ₹1000.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'savings_tracking');
  const travelGoal = result.nextState.financial_state.goals.find(goal => goal.id === 'travel');
  assert.strictEqual(travelGoal.savedAmount, 1200);
});

test('festival handling scenario updates multiplier and rent due deterministically', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 7000,
      savings: 2000,
      languagePreference: 'en'
    },
    metadata: {
      festivalMetadata: {
        diwali: { name: 'Diwali', multiplier: 1.1, budgetImpact: 500 }
      }
    },
    event: {
      type: 'festival',
      festivalId: 'diwali'
    }
  });

  assert.strictEqual(result.response.message, 'Diwali boost 1.1x applied. Rent ₹7700, savings ₹2000.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'festival_multiplier');
  assert.strictEqual(result.nextState.rentDue, 7700);
});

test('offline resilience scenario preserves state with stub messaging', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 3000,
      savings: 500,
      offlineSince: null
    },
    event: {
      type: 'offline',
      offlineSince: '2023-10-15T00:00:00Z'
    }
  });

  assert.strictEqual(result.nextState.offlineSince, '2023-10-15T00:00:00Z');
  assert.strictEqual(result.response.message, 'Offline safe stub since 2023-10-15T00:00:00Z. Rent ₹3000, buffer ₹0.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'offline_stub');
});

test('dpdp notice scenario records acknowledgements', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 2000,
      savings: 1000
    },
    event: {
      type: 'dpdp',
      noticeVersion: '2023-09'
    }
  });

  assert.strictEqual(result.nextState.dpdpNoticeVersionAck, '2023-09');
  assert.strictEqual(result.response.message, 'DPDP v2023-09 noted. Rent ₹2000, savings ₹1000.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'dpdp_notice');
});

test('safety enforcement scenario toggles safety flags with deterministic copy', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 4000,
      savings: 1500,
      safetyFlags: { blockTransfers: false },
      languagePreference: 'en'
    },
    event: {
      type: 'safety',
      flag: 'blockTransfers',
      value: true
    }
  });

  assert.strictEqual(result.nextState.safetyFlags.blockTransfers, true);
  assert.strictEqual(result.response.message, 'Safety blockTransfers on. Transfers paused. Rent ₹4000.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'safety_hook');
});

test('multilingual handling honors auto-detected Tamil fallback', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 2500,
      savings: 800,
      languagePreference: null,
      autoDetectedLanguages: [],
      goals: [{ id: 'edu', name: 'Edu', targetAmount: 3000, savedAmount: 500 }]
    },
    metadata: {
      goalMetadata: [{ id: 'edu', name: 'School', targetAmount: 3000, priority: 1 }]
    },
    event: {
      type: 'multilingual',
      amount: 500
    },
    context: {
      autoDetectedLanguages: ['ta']
    }
  });

  assert.strictEqual(result.response.language, 'ta');
  assert.strictEqual(result.response.message, 'தமிழ் பதில். இலக்கு School 16.67% நிலை.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'language_selection');
});

test('performance budget scenario enforces trims under tight budget', () => {
  const result = runRuleEngine({
    financialState: {
      rentDue: 1000,
      savings: 300,
      goals: [{ id: 'health', name: 'Health', targetAmount: 1000, savedAmount: 300 }]
    },
    event: {
      type: 'performance',
      complexity: 10
    },
    config: {
      performanceBudgetMs: 5
    }
  });

  assert.strictEqual(result.nextState.performanceTrimmed, true);
  assert.strictEqual(result.response.message, 'Cost 12 ops, budget 5ms trimmed. Rent ₹1000, savings ₹300.');
  expectSmsLimit(result.response.message);
  expectAuditRule(result, 'performance_budget');
});
