const { GoalService } = require('./goalService');
const { GoalStore } = require('./goalStore');
const { ReminderEngine } = require('./reminderEngine');
const { LocalizationProvider } = require('./localization');
const { ProgressVisualizer } = require('./progressVisualizer');
const { AuditLogger } = require('./auditLogger');
const { GoalRouter } = require('./router');

function createGoalModule(options = {}) {
  const auditLogger = options.auditLogger || new AuditLogger();
  const store = options.store || new GoalStore({ auditLogger });
  const localization = options.localization || new LocalizationProvider();
  const visualizer = options.visualizer || new ProgressVisualizer();
  const reminderEngine = options.reminderEngine || new ReminderEngine({
    store,
    localization,
    auditLogger,
    visualizer,
  });
  const service = options.service || new GoalService({ store, reminderEngine, visualizer });
  const router = new GoalRouter({ service });

  return {
    store,
    service,
    router,
    auditLogger,
    localization,
    reminderEngine,
    visualizer,
  };
}

module.exports = { createGoalModule };
