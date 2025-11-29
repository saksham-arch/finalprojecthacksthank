const { IntentExtractor } = require('./intentExtractor');
const { PromptBuilder } = require('./promptBuilder');
const { Guardrails } = require('./guardrails');
const { routeIntent } = require('./routingRules');
const { BudgetModule } = require('../modules/budgetModule');
const { CashflowModule } = require('../modules/cashflowModule');
const { GoalModule } = require('../modules/goalModule');
const { HistoryStore } = require('../data/historyStore');
const { LocalQueue } = require('../channels/localQueue');
const { TwilioAdapter } = require('../channels/twilioAdapter');
const { ExotelAdapter } = require('../channels/exotelAdapter');
const { AuditLogger } = require('../utils/auditLogger');
const { DPDPService } = require('../compliance/dpdpService');

class IntentRouter {
  constructor({
    historyStore,
    dpdpService,
    auditLogger,
    guardrails,
    promptBuilder,
    intentExtractor,
    queue,
    modules,
    adapters,
  } = {}) {
    this.historyStore = historyStore || new HistoryStore();
    this.dpdpService = dpdpService || new DPDPService();
    this.auditLogger = auditLogger || new AuditLogger();
    this.guardrails = guardrails || new Guardrails({ auditLogger: this.auditLogger });
    this.intentExtractor = intentExtractor || new IntentExtractor();
    this.promptBuilder =
      promptBuilder || new PromptBuilder({ historyStore: this.historyStore });
    this.queue = queue || new LocalQueue();

    this.modules =
      modules ||
      {
        budget: new BudgetModule(),
        cashflow: new CashflowModule(),
        goal: new GoalModule(),
      };

    const defaultAdapters = {
      twilio: new TwilioAdapter({ queue: this.queue }),
      exotel: new ExotelAdapter({ queue: this.queue }),
    };

    this.adapters = { ...defaultAdapters, ...(adapters || {}) };
  }

  async handleRequest(request) {
    const {
      userId,
      userContact,
      locale = 'en',
      provider = 'twilio',
      channelType = 'sms',
      message,
      metadata = {},
    } = request;

    const adapter = this.adapters[provider];
    if (!adapter) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const consentGranted = await this.dpdpService.ensureConsent({
      userId,
      locale,
      channelAdapter: adapter,
      destination: userContact,
    });

    if (!consentGranted) {
      return {
        status: 'consent_pending',
        message: this.dpdpService.getLocalized('consent_pending', locale),
      };
    }

    const history = this.historyStore.getHistory(userId, 90);
    const prompt = this.promptBuilder.build({
      channelType,
      userId,
      locale,
      history,
      festivalContext: metadata.festival,
      complianceOverrides: metadata.complianceReminders,
    });

    const intentResult = this.intentExtractor.extract(message);
    const module = routeIntent(intentResult.intent, this.modules);
    const moduleResponse = module.handle({
      entities: intentResult.entities,
      prompt,
      channelType,
    });

    const guardrailResult = await this.guardrails.enforce(moduleResponse, {
      userId,
      channel: channelType,
    });

    await this.dispatchResponse({
      adapter,
      channelType,
      contact: userContact,
      response: guardrailResult.output,
      prompt,
    });

    this.historyStore.recordInteraction(userId, {
      direction: 'inbound',
      channel: channelType,
      message,
    });
    this.historyStore.recordInteraction(userId, {
      direction: 'outbound',
      channel: channelType,
      message: guardrailResult.output,
    });

    await this.dpdpService.scheduleDeletionWarning({
      userId,
      locale,
      channelAdapter: adapter,
      destination: userContact,
    });

    return {
      status: 'delivered',
      intent: intentResult.intent,
      module: module.constructor.name,
      guardrailAction: guardrailResult.action,
      response: guardrailResult.output,
    };
  }

  async dispatchResponse({ adapter, channelType, contact, response, prompt }) {
    if (channelType === 'voice') {
      const script = adapter.prepareVoiceScript({ explanation: response, context: prompt });
      return adapter.sendVoiceCall({ to: contact, script });
    }
    return adapter.sendSMS({ to: contact, body: response });
  }
}

module.exports = { IntentRouter };
