const BudgetPlanner = require('./planner');
const { PlanHistoryStore, createHistoryStore } = require('./history');
const { AuditLogger } = require('./audit');
const { deriveEnvelopeWeights, computeVariability, REQUIRED_ENVELOPES } = require('./envelopes');
const { describeFestivalPhase, DEFAULT_FESTIVALS } = require('./calendar');
const { formatSms, SMS_LIMIT } = require('./localization');

function createBudgetAdvisor(options = {}) {
  const planner = new BudgetPlanner(options);
  return {
    planFor: (payload) => planner.plan(payload),
    historyStore: planner.historyStore,
    auditLogger: planner.auditLogger
  };
}

module.exports = {
  createBudgetAdvisor,
  BudgetPlanner,
  PlanHistoryStore,
  createHistoryStore,
  AuditLogger,
  deriveEnvelopeWeights,
  computeVariability,
  REQUIRED_ENVELOPES,
  describeFestivalPhase,
  DEFAULT_FESTIVALS,
  formatSms,
  SMS_LIMIT
};
