const { IntentRouter } = require('./router');
const { DPDPService } = require('./compliance/dpdpService');
const { TwilioAdapter } = require('./channels/twilioAdapter');
const { ExotelAdapter } = require('./channels/exotelAdapter');
const { LocalQueue } = require('./channels/localQueue');
const { Guardrails } = require('./router/guardrails');
const { PromptBuilder } = require('./router/promptBuilder');
const { IntentExtractor } = require('./router/intentExtractor');
const { AuditLogger } = require('./utils/auditLogger');
const { HistoryStore } = require('./data/historyStore');

module.exports = {
  IntentRouter,
  DPDPService,
  TwilioAdapter,
  ExotelAdapter,
  LocalQueue,
  Guardrails,
  PromptBuilder,
  IntentExtractor,
  AuditLogger,
  HistoryStore,
};
