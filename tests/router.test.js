const { IntentRouter } = require('../src/router');
const { Guardrails } = require('../src/router/guardrails');
const { HistoryStore } = require('../src/data/historyStore');

class MemoryAuditLogger {
  constructor() {
    this.entries = [];
  }
  async write(event) {
    this.entries.push(event);
  }
}

const createAdapterMock = () => {
  return {
    sendSMS: jest.fn().mockResolvedValue({ status: 'sent' }),
    sendVoiceCall: jest.fn().mockResolvedValue({ status: 'sent' }),
    prepareVoiceScript: jest.fn(({ explanation }) => explanation.split(/\s+/).slice(0, 10).join(' ')),
  };
};

describe('IntentRouter', () => {
  let adapter;
  let dpdpService;
  let historyStore;
  let guardrails;

  beforeEach(() => {
    adapter = createAdapterMock();
    dpdpService = {
      ensureConsent: jest.fn().mockResolvedValue(true),
      scheduleDeletionWarning: jest.fn().mockResolvedValue(true),
      getLocalized: jest.fn().mockReturnValue('pending'),
    };
    historyStore = new HistoryStore();
    guardrails = new Guardrails({ auditLogger: new MemoryAuditLogger() });
  });

  it('routes budget intent to BudgetModule', async () => {
    const router = new IntentRouter({
      adapters: { twilio: adapter },
      dpdpService,
      guardrails,
      historyStore,
    });

    const result = await router.handleRequest({
      userId: 'user-1',
      userContact: '+1000000000',
      provider: 'twilio',
      channelType: 'sms',
      locale: 'en',
      message: 'Need budget help for ₹5,000 soon',
      metadata: {},
    });

    expect(result.intent).toBe('budget');
    expect(result.module).toBe('BudgetModule');
    expect(adapter.sendSMS).toHaveBeenCalled();
  });

  it('routes goal intent to GoalModule for planning queries', async () => {
    const router = new IntentRouter({
      adapters: { twilio: adapter },
      dpdpService,
      guardrails,
      historyStore,
    });

    const result = await router.handleRequest({
      userId: 'user-2',
      userContact: '+1000000001',
      provider: 'twilio',
      channelType: 'sms',
      locale: 'en',
      message: 'Help me plan a retirement goal for next year',
    });

    expect(result.intent).toBe('goal');
    expect(result.module).toBe('GoalModule');
  });

  it('supports voice channel via adapter hooks', async () => {
    const router = new IntentRouter({
      adapters: { exotel: adapter },
      dpdpService,
      guardrails,
      historyStore,
    });

    const result = await router.handleRequest({
      userId: 'user-voice',
      userContact: '+1999999999',
      provider: 'exotel',
      channelType: 'voice',
      locale: 'en',
      message: 'Check cashflow outlook this month',
    });

    expect(result.intent).toBe('cashflow');
    expect(adapter.prepareVoiceScript).toHaveBeenCalled();
    expect(adapter.sendVoiceCall).toHaveBeenCalled();
  });
});
