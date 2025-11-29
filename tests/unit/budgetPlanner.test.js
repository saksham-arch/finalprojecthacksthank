const { BudgetPlanner } = require('../../src/modules/budget');
const { validateBudgetPlan } = require('../../src/router/schema');

function sumEnvelopes(envelopes) {
  return envelopes.reduce((acc, envelope) => acc + envelope.amount, 0);
}

describe('BudgetPlanner', () => {
  test('allocates rent first with a ₹3,000 cap', () => {
    const planner = new BudgetPlanner();
    const plan = planner.plan({
      userId: 'rent-user',
      income: 8000,
      rentDue: 5000,
      interactionCount: 1,
      locale: 'en',
      incomeHistory: [7800, 8200],
      date: '2024-07-01'
    });

    expect(plan.allocations.rent.amount).toBe(3000);
    const envelopeTotal = sumEnvelopes(plan.allocations.envelopes);
    expect(envelopeTotal + plan.allocations.rent.amount + plan.allocations.summary.leftover).toBe(plan.allocations.summary.totalIncome);
  });

  test('festival proximity boosts savings and festival pots before Diwali', () => {
    const planner = new BudgetPlanner();
    const baseline = planner.plan({
      userId: 'baseline-user',
      income: 12000,
      rentDue: 2000,
      interactionCount: 6,
      locale: 'en',
      incomeHistory: [12000, 11800, 11950],
      date: '2024-02-10'
    });

    const preDiwali = planner.plan({
      userId: 'festival-user',
      income: 12000,
      rentDue: 2000,
      interactionCount: 6,
      locale: 'en',
      incomeHistory: [12000, 11800, 11950],
      date: '2024-10-10'
    });

    const baselineSavings = baseline.allocations.envelopes.find((entry) => entry.name === 'bachatDabba').amount;
    const boostedSavings = preDiwali.allocations.envelopes.find((entry) => entry.name === 'bachatDabba').amount;
    const baselineFestival = baseline.allocations.envelopes.find((entry) => entry.name === 'festivalPot').amount;
    const boostedFestival = preDiwali.allocations.envelopes.find((entry) => entry.name === 'festivalPot').amount;

    expect(boostedSavings).toBeGreaterThanOrEqual(baselineSavings);
    expect(boostedFestival).toBeGreaterThanOrEqual(baselineFestival);
    expect(preDiwali.meta.festivalPhase.phase).toBe('pre');
  });

  test('progressive disclosure shows micro tips for early interactions and breakdown later', () => {
    const planner = new BudgetPlanner();
    const earlyPlan = planner.plan({
      userId: 'new-user',
      income: 6000,
      rentDue: 1500,
      interactionCount: 2,
      locale: 'en',
      incomeHistory: [6000, 6050],
      date: '2024-05-01'
    });

    const returningPlan = planner.plan({
      userId: 'returning-user',
      income: 6000,
      rentDue: 1500,
      interactionCount: 7,
      locale: 'en',
      incomeHistory: [6000, 6050],
      date: '2024-05-01'
    });

    expect(earlyPlan.guidance.type).toBe('micro-tip');
    expect(typeof earlyPlan.guidance.nextStep).toBe('string');
    expect(returningPlan.guidance.type).toBe('full-breakdown');
    expect(Array.isArray(returningPlan.guidance.steps)).toBe(true);
    expect(returningPlan.guidance.steps.length).toBeGreaterThan(0);
  });

  test('provides localized SMS templates for Hindi and Tamil under 160 chars', () => {
    const planner = new BudgetPlanner();
    const hindiPlan = planner.plan({
      userId: 'hindi-user',
      income: 7000,
      rentDue: 2000,
      interactionCount: 3,
      locale: 'hi',
      incomeHistory: [7000, 6900, 7100],
      date: '2024-06-15'
    });

    const tamilPlan = planner.plan({
      userId: 'tamil-user',
      income: 7000,
      rentDue: 2000,
      interactionCount: 3,
      locale: 'ta',
      incomeHistory: [7000, 6900, 7100],
      date: '2024-06-15'
    });

    expect(hindiPlan.communication.sms.locale).toBe('hi');
    expect(hindiPlan.communication.sms.text).toContain('Chhat');
    expect(hindiPlan.communication.sms.text.includes('➤')).toBe(true);
    expect(hindiPlan.communication.sms.text.length).toBeLessThanOrEqual(160);

    expect(tamilPlan.communication.sms.locale).toBe('ta');
    expect(tamilPlan.communication.sms.text).toContain('Saapadu');
    expect(tamilPlan.communication.sms.text.includes('➤')).toBe(true);
    expect(tamilPlan.communication.sms.text.length).toBeLessThanOrEqual(160);
  });

  test('communication SMS respects 160 char limit even for large numbers', () => {
    const planner = new BudgetPlanner();
    const plan = planner.plan({
      userId: 'sms-limit-user',
      income: 25000,
      rentDue: 1000,
      interactionCount: 4,
      locale: 'en',
      incomeHistory: [25000, 24000, 26000],
      date: '2024-03-01'
    });

    expect(plan.communication.sms.text.length).toBeLessThanOrEqual(160);
  });

  test('contract validation passes for generated plans', () => {
    const planner = new BudgetPlanner();
    const plan = planner.plan({
      userId: 'contract-user',
      income: 9000,
      rentDue: 1800,
      interactionCount: 6,
      locale: 'en',
      consent: { dpdp: true },
      incomeHistory: [9000, 8800, 9400],
      date: '2024-04-15'
    });

    const validation = validateBudgetPlan(plan);
    expect(validation.valid).toBe(true);
  });

  test('history persistence respects DPDP consent', () => {
    const planner = new BudgetPlanner();
    const noConsentPlan = planner.plan({
      userId: 'privacy-user',
      income: 5000,
      rentDue: 1000,
      interactionCount: 1,
      locale: 'en',
      consent: { dpdp: false },
      incomeHistory: [5000, 5100],
      date: '2024-02-01'
    });

    expect(noConsentPlan.meta.historyPersisted).toBe(false);
    expect(planner.historyStore.find('privacy-user')).toHaveLength(0);

    const consentPlan = planner.plan({
      userId: 'privacy-user-2',
      income: 5000,
      rentDue: 1000,
      interactionCount: 1,
      locale: 'en',
      consent: { dpdp: true },
      incomeHistory: [5000, 5100],
      date: '2024-02-01'
    });

    expect(consentPlan.meta.historyPersisted).toBe(true);
    expect(planner.historyStore.find('privacy-user-2').length).toBe(1);
  });
});
