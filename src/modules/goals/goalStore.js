const { GOAL_MIN_AMOUNT, GOAL_MAX_AMOUNT, INACTIVITY_DAYS } = require('./constants');

class GoalStore {
  constructor({ auditLogger } = {}) {
    this.auditLogger = auditLogger;
    this.goals = [];
    this.goalProgress = [];
    this.reminders = [];
    this.sequence = 0;
  }

  createGoal({ userId, title, targetAmount, locale = 'en-IN', consent = {} }) {
    this._assertAmountWithinBounds(targetAmount);
    const goal = {
      id: this._nextId('goal'),
      userId,
      title,
      targetAmount,
      locale,
      consent: {
        sms: consent.sms !== false,
        voice: consent.voice !== false,
      },
      createdAt: new Date(),
      deletedAt: null,
      milestonesAchieved: [],
    };
    this.goals.push(goal);
    this._log('goal:create', { goalId: goal.id, userId, targetAmount });
    return goal;
  }

  getGoal(goalId) {
    const goal = this.goals.find((item) => item.id === goalId);
    if (!goal || goal.deletedAt) {
      throw new Error('Goal not found or deleted');
    }
    return goal;
  }

  listActiveGoals() {
    return this.goals.filter((goal) => !goal.deletedAt);
  }

  markDeleted(goalId, timestamp = new Date()) {
    const goal = this.getGoal(goalId);
    goal.deletedAt = new Date(timestamp);
    this._log('goal:delete', { goalId });
  }

  appendProgress(goalId, amount, timestamp = new Date(), source = 'manual') {
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Progress amount must be positive');
    }
    const goal = this.getGoal(goalId);
    const entry = {
      id: this._nextId('progress'),
      goalId,
      amount: numericAmount,
      timestamp: new Date(timestamp),
      source,
    };
    this.goalProgress.push(entry);
    this._log('goal:progress', { goalId, amount: numericAmount });
    return entry;
  }

  listProgress(goalId) {
    return this.goalProgress.filter((entry) => entry.goalId === goalId);
  }

  getProgressAmount(goalId) {
    return this.listProgress(goalId).reduce((sum, entry) => sum + entry.amount, 0);
  }

  getProgressPercent(goalId) {
    const goal = this.getGoal(goalId);
    const amount = this.getProgressAmount(goalId);
    return (amount / goal.targetAmount) * 100;
  }

  getLastProgressDate(goalId) {
    const entries = this.listProgress(goalId);
    if (entries.length === 0) {
      return this.getGoal(goalId).createdAt;
    }
    return entries[entries.length - 1].timestamp;
  }

  addReminder({ goalId, type, channel, locale, message, scheduledAt = new Date(), metadata = {} }) {
    const reminder = {
      id: this._nextId('reminder'),
      goalId,
      type,
      channel,
      locale,
      message,
      scheduledAt: new Date(scheduledAt),
      metadata,
    };
    this.reminders.push(reminder);
    this._log('reminder:queued', { goalId, type, channel });
    return reminder;
  }

  getRemindersByGoal(goalId, type) {
    return this.reminders.filter((reminder) => reminder.goalId === goalId && (!type || reminder.type === type));
  }

  hasRecentRecoveryReminder(goalId, currentDate) {
    const windowMs = INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
    return this.reminders.some(
      (reminder) =>
        reminder.goalId === goalId && reminder.type === 'recovery' && currentDate - reminder.scheduledAt < windowMs,
    );
  }

  _assertAmountWithinBounds(amount) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      throw new Error('Target amount must be numeric');
    }
    if (amount < GOAL_MIN_AMOUNT || amount > GOAL_MAX_AMOUNT) {
      throw new RangeError(`Goals must be between ₹${GOAL_MIN_AMOUNT} and ₹${GOAL_MAX_AMOUNT}`);
    }
  }

  _nextId(prefix) {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  _log(event, payload) {
    if (this.auditLogger) {
      this.auditLogger.log(event, payload);
    }
  }
}

module.exports = { GoalStore };
