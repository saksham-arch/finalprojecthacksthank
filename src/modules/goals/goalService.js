const { INACTIVITY_DAYS, MILESTONES } = require('./constants');

class GoalService {
  constructor({ store, reminderEngine, visualizer }) {
    this.store = store;
    this.reminderEngine = reminderEngine;
    this.visualizer = visualizer;
  }

  createGoal(payload) {
    return this.store.createGoal(payload);
  }

  logProgress({ goalId, amount, timestamp = new Date(), locale }) {
    const goal = this.store.getGoal(goalId);
    this._updateLocale(goal, locale);
    const entry = this.store.appendProgress(goalId, amount, timestamp, 'goal-progress');
    const percent = this.store.getProgressPercent(goalId);
    const bar = this.visualizer.buildBar(percent);
    const triggeredMilestones = this._resolveMilestones(goal, percent, bar, timestamp);

    return {
      entry,
      percent,
      progressBar: bar,
      triggeredMilestones,
    };
  }

  registerIncomeEvent({ goalId, incomeAmount, timestamp = new Date(), locale }) {
    const numericAmount = Number(incomeAmount);
    if (Number.isNaN(numericAmount)) {
      throw new Error('Income amount must be numeric');
    }
    const goal = this.store.getGoal(goalId);
    this._updateLocale(goal, locale);
    const percent = this.store.getProgressPercent(goalId);
    const bar = this.visualizer.buildBar(percent);
    return this.reminderEngine.scheduleIncomeReminder({
      goal,
      incomeAmount: numericAmount,
      timestamp: new Date(timestamp),
      progressPercent: percent,
      progressBar: bar,
    });
  }

  runRecovery({ currentDate = new Date() } = {}) {
    const dateObject = new Date(currentDate);
    const reminders = [];
    this.store.listActiveGoals().forEach((goal) => {
      const lastActivity = this.store.getLastProgressDate(goal.id);
      const daysInactive = this._differenceInDays(lastActivity, dateObject);
      if (daysInactive >= INACTIVITY_DAYS && !this.store.hasRecentRecoveryReminder(goal.id, dateObject)) {
        const created = this.reminderEngine.scheduleRecoveryReminder({
          goal,
          daysInactive,
          timestamp: dateObject,
        });
        reminders.push(...created);
      }
    });
    return reminders;
  }

  deleteGoal(goalId, timestamp = new Date()) {
    this.store.markDeleted(goalId, timestamp);
  }

  _resolveMilestones(goal, percent, bar, timestamp) {
    const achieved = goal.milestonesAchieved || [];
    const triggered = [];
    MILESTONES.forEach((milestone) => {
      const milestonePercent = milestone * 100;
      if (percent >= milestonePercent && !achieved.includes(milestone)) {
        achieved.push(milestone);
        triggered.push(milestone);
        this.reminderEngine.scheduleMilestone({
          goal,
          percent,
          milestone,
          progressBar: bar,
          timestamp,
        });
      }
    });
    goal.milestonesAchieved = achieved;
    return triggered;
  }

  _differenceInDays(from, to) {
    const diff = new Date(to) - new Date(from);
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }

  _updateLocale(goal, locale) {
    if (locale) {
      goal.locale = locale;
    }
  }
}

module.exports = { GoalService };
