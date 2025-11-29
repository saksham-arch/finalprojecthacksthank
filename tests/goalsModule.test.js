const { createGoalModule } = require('../src/modules/goals');
const { GOAL_MIN_AMOUNT, GOAL_MAX_AMOUNT } = require('../src/modules/goals/constants');

describe('Goal tracker module', () => {
  test('enforces micro-goal creation bounds', () => {
    const { service } = createGoalModule();
    expect(() =>
      service.createGoal({ userId: 'u1', title: 'Tiny', targetAmount: GOAL_MIN_AMOUNT - 1 }),
    ).toThrow(/₹/);

    const goal = service.createGoal({ userId: 'u1', title: 'Valid', targetAmount: GOAL_MAX_AMOUNT });
    expect(goal.targetAmount).toBe(GOAL_MAX_AMOUNT);
  });

  test('schedules SMS + voice reminders tied to income logs', () => {
    const module = createGoalModule();
    const goal = module.service.createGoal({ userId: 'u1', title: 'Rainy Day', targetAmount: 8000 });
    const reminders = module.service.registerIncomeEvent({ goalId: goal.id, incomeAmount: 2000 });

    const storedReminders = module.store.getRemindersByGoal(goal.id, 'income-follow-up');
    expect(reminders.length).toBe(storedReminders.length);
    expect(storedReminders.length).toBeGreaterThanOrEqual(1);
    expect(storedReminders[0].metadata.recommendedAmount).toBeGreaterThan(0);

    const auditEntry = module.auditLogger.list().find((entry) => entry.event === 'recommendation:income-follow-up');
    expect(auditEntry).toBeTruthy();
  });

  test('triggers empathetic recovery after 14 days of inactivity', () => {
    const module = createGoalModule();
    const goal = module.service.createGoal({ userId: 'u2', title: 'Health Kit', targetAmount: 6000 });
    module.service.logProgress({ goalId: goal.id, amount: 600, timestamp: new Date('2023-01-01') });

    const early = module.service.runRecovery({ currentDate: new Date('2023-01-10') });
    expect(early.length).toBe(0);

    const late = module.service.runRecovery({ currentDate: new Date('2023-01-20') });
    expect(late.length).toBeGreaterThan(0);
    const recoveryReminders = module.store.getRemindersByGoal(goal.id, 'recovery');
    const recoverySms = recoveryReminders.find((reminder) => reminder.channel === 'sms');
    expect(recoveryReminders.length).toBeGreaterThanOrEqual(1);
    expect(recoverySms).toBeTruthy();
    expect(recoverySms.metadata.daysInactive).toBeGreaterThanOrEqual(14);
  });

  test('celebrates milestones with progress visuals and SMS length guard', () => {
    const module = createGoalModule();
    const goal = module.service.createGoal({ userId: 'u3', title: 'Milestone', targetAmount: 8000 });
    const result = module.service.logProgress({ goalId: goal.id, amount: 2000 });

    expect(result.triggeredMilestones).toContain(0.25);
    const milestoneSms = module
      .store
      .getRemindersByGoal(goal.id, 'milestone')
      .find((reminder) => reminder.channel === 'sms');
    expect(milestoneSms).toBeTruthy();
    expect(milestoneSms.message).toContain('25%');
    expect(milestoneSms.message.length).toBeLessThanOrEqual(160);
  });

  test('produces localized hi-IN templates with analogies', () => {
    const module = createGoalModule();
    const goal = module.service.createGoal({ userId: 'u4', title: 'Shiksha', targetAmount: 7000, locale: 'hi-IN' });
    module.service.registerIncomeEvent({ goalId: goal.id, incomeAmount: 1500, locale: 'hi-IN' });
    const reminder = module
      .store
      .getRemindersByGoal(goal.id, 'income-follow-up')
      .find((item) => item.channel === 'sms');

    expect(reminder).toBeTruthy();
    expect(reminder.locale).toBe('hi-IN');
    expect(reminder.message.toLowerCase()).toMatch(/aamdani|gullak|dabba/);
  });

  test('caps SMS reminders under 160 characters', () => {
    const module = createGoalModule();
    const goal = module.service.createGoal({ userId: 'u5', title: 'Length Check', targetAmount: 9000 });
    module.service.registerIncomeEvent({ goalId: goal.id, incomeAmount: 5000 });
    const reminder = module
      .store
      .getRemindersByGoal(goal.id, 'income-follow-up')
      .find((item) => item.channel === 'sms');

    expect(reminder).toBeTruthy();
    expect(reminder.message.length).toBeLessThanOrEqual(160);
  });

  test('router contract compliance across endpoints', () => {
    const module = createGoalModule();
    const createResponse = module.router.handle({
      method: 'POST',
      path: '/goals',
      body: { userId: 'router', title: 'Router Goal', targetAmount: 5500 },
    });
    expect(createResponse.statusCode).toBe(201);
    const createdGoalId = createResponse.body.data.id;

    const progressResponse = module.router.handle({
      method: 'POST',
      path: `/goals/${createdGoalId}/progress`,
      body: { amount: 500 },
    });
    expect(progressResponse.statusCode).toBe(200);
    expect(progressResponse.body.data.percent).toBeGreaterThan(0);

    const incomeResponse = module.router.handle({
      method: 'POST',
      path: `/goals/${createdGoalId}/income`,
      body: { incomeAmount: 800 },
    });
    expect(incomeResponse.statusCode).toBe(202);
    expect(Array.isArray(incomeResponse.body.data)).toBe(true);

    const recoveryResponse = module.router.handle({
      method: 'POST',
      path: '/goals/recovery/check',
      body: { currentDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() },
    });
    expect(recoveryResponse.statusCode).toBe(200);
    expect(Array.isArray(recoveryResponse.body.data)).toBe(true);

    const missing = module.router.handle({ method: 'GET', path: '/does-not-exist' });
    expect(missing.statusCode).toBe(404);
  });
});
