const { CashflowService, dataStores } = require('../src/modules/cashflow');

function buildRichHistory() {
  const history = [];
  for (let month = 0; month < 12; month += 1) {
    history.push({
      date: new Date(2023, month, 15).toISOString(),
      amount: 1100 + month * 30
    });
  }
  return history;
}

describe('CashflowService', () => {
  let service;

  beforeEach(() => {
    dataStores.reset();
    service = new CashflowService({ incomeGapThreshold: 1200 });
  });

  test('blends baselines with seasonal history for irregular earners', () => {
    const coldStartResult = service.forecast({
      userId: 'user-cold',
      gigType: 'delivery',
      region: 'urban',
      history: [],
      referenceDate: new Date('2024-01-05'),
      horizonDays: 2
    });

    expect(coldStartResult.predictions).toHaveLength(2);
    expect(coldStartResult.predictions[0].scenario).toBe('cold-start');
    expect(coldStartResult.predictions[0].amount).toBeCloseTo(1000, 1);
    expect(dataStores.getCashflowPredictions()[0].explanation).toMatch(/Scenario cold-start/i);

    const history = buildRichHistory();
    const historyResult = service.forecast({
      userId: 'user-rich',
      gigType: 'delivery',
      region: 'urban',
      history,
      referenceDate: new Date('2024-03-05'),
      horizonDays: 2
    });

    expect(historyResult.predictions[0].scenario).toBe('history-rich');
    expect(historyResult.predictions[0].amount).toBeGreaterThan(1000);
    expect(dataStores.getCashflowPredictions()).toHaveLength(4);
  });

  test('injects festival boosts and monsoon dampening with explanations', () => {
    const diwaliResult = service.forecast({
      userId: 'festival-user',
      gigType: 'ride-share',
      region: 'urban',
      history: [],
      referenceDate: new Date('2024-11-01'),
      horizonDays: 1
    });

    const diwaliPrediction = diwaliResult.predictions[0];
    const festivalAdjustment = diwaliPrediction.adjustments.find((adj) => adj.type === 'festival');
    expect(festivalAdjustment).toBeTruthy();
    expect(festivalAdjustment.name).toBe('Diwali');
    expect(diwaliPrediction.amount).toBeGreaterThan(1500);

    const monsoonResult = service.forecast({
      userId: 'monsoon-user',
      gigType: 'ride-share',
      region: 'urban',
      history: [],
      referenceDate: new Date('2024-07-05'),
      horizonDays: 1
    });

    const monsoonPrediction = monsoonResult.predictions[0];
    const monsoonAdjustment = monsoonPrediction.adjustments.find((adj) => adj.type === 'monsoon');
    expect(monsoonAdjustment).toBeTruthy();
    expect(monsoonPrediction.amount).toBeLessThan(1500);
  });

  test('enqueues sms and voice alerts respecting the 48-hour cadence and limits', () => {
    const tightService = new CashflowService({ incomeGapThreshold: 1500, horizonDays: 3 });
    dataStores.reset();

    const lowResult = tightService.forecast({
      userId: 'gap-user',
      gigType: 'freelance',
      region: 'rural',
      history: [{ date: new Date('2023-02-01').toISOString(), amount: 500 }],
      referenceDate: new Date('2024-02-01'),
      horizonDays: 3
    });

    expect(lowResult.alerts).toContain('income-gap');
    const queue = dataStores.getOfflineQueue();
    expect(queue).toHaveLength(2);

    const smsJob = queue.find((job) => job.type === 'SMS');
    const voiceJob = queue.find((job) => job.type === 'VOICE');
    expect(smsJob.payload.message.length).toBeLessThanOrEqual(160);
    expect(/\n/.test(smsJob.payload.message)).toBe(false);
    expect(voiceJob.payload.wordCount).toBeLessThanOrEqual(35);
    expect(voiceJob.payload.durationSeconds).toBeLessThanOrEqual(15);

    // second run within 48 hours should not enqueue again
    tightService.forecast({
      userId: 'gap-user',
      gigType: 'freelance',
      region: 'rural',
      history: [{ date: new Date('2023-02-01').toISOString(), amount: 500 }],
      referenceDate: new Date('2024-02-02'),
      horizonDays: 3
    });
    expect(dataStores.getOfflineQueue()).toHaveLength(2);

    // after cadence window, alerts resume
    tightService.forecast({
      userId: 'gap-user',
      gigType: 'freelance',
      region: 'rural',
      history: [{ date: new Date('2023-02-01').toISOString(), amount: 500 }],
      referenceDate: new Date('2024-02-05'),
      horizonDays: 3
    });
    expect(dataStores.getOfflineQueue()).toHaveLength(4);
  });

  test('records audit log entries with confidence scores for each prediction', () => {
    service.forecast({
      userId: 'audit-user',
      gigType: 'delivery',
      region: 'urban',
      history: buildRichHistory(),
      referenceDate: new Date('2024-04-01'),
      horizonDays: 3
    });

    const audits = dataStores.getAuditLog();
    expect(audits).toHaveLength(3);
    audits.forEach((entry) => {
      expect(entry.details.confidence).toBeGreaterThan(0);
      expect(entry.details.scenario).toBeDefined();
    });
  });
});
