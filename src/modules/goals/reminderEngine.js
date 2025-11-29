class ReminderEngine {
  constructor({ store, localization, auditLogger, visualizer }) {
    this.store = store;
    this.localization = localization;
    this.auditLogger = auditLogger;
    this.visualizer = visualizer;
  }

  scheduleMilestone({ goal, percent, milestone, progressBar, timestamp = new Date() }) {
    const roundedPercent = Math.round(percent);
    const bar = progressBar || this.visualizer.buildBar(roundedPercent);
    const payload = { goalName: goal.title, percent: roundedPercent, bar };
    return this._dispatchReminder({
      goal,
      type: 'milestone',
      timestamp,
      payload,
      metadata: { milestone: milestone * 100, bar },
    });
  }

  scheduleIncomeReminder({ goal, incomeAmount, timestamp = new Date(), progressPercent = 0, progressBar }) {
    if (incomeAmount <= 0) {
      throw new Error('Income amount must be positive');
    }
    const recommendedAmount = this._recommendAmount(goal, incomeAmount);
    if (recommendedAmount <= 0) {
      return [];
    }
    const bar = progressBar || this.visualizer.buildBar(progressPercent);
    const payload = {
      goalName: goal.title,
      percent: Math.round(progressPercent),
      recommendedAmount,
      bar,
    };
    return this._dispatchReminder({
      goal,
      type: 'income',
      subType: 'income-follow-up',
      timestamp,
      payload,
      metadata: { recommendedAmount },
    });
  }

  scheduleRecoveryReminder({ goal, daysInactive, timestamp = new Date() }) {
    const percent = Math.round(this.store.getProgressPercent(goal.id) || 0);
    const payload = { goalName: goal.title, daysInactive, percent };
    return this._dispatchReminder({
      goal,
      type: 'recovery',
      timestamp,
      payload,
      metadata: { daysInactive },
    });
  }

  _dispatchReminder({ goal, type, subType, timestamp, payload, metadata }) {
    const reminders = [];
    if (!goal || goal.deletedAt) {
      return reminders;
    }

    if (goal.consent?.sms) {
      const sms = this.localization.buildSms({ locale: goal.locale, type: type === 'income' ? 'income' : type, payload });
      reminders.push(
        this.store.addReminder({
          goalId: goal.id,
          type: subType || type,
          channel: 'sms',
          locale: sms.locale,
          message: sms.text,
          scheduledAt: timestamp,
          metadata,
        }),
      );
    }

    if (goal.consent?.voice) {
      const voice = this.localization.buildVoice({ locale: goal.locale, type: type === 'income' ? 'income' : type, payload });
      reminders.push(
        this.store.addReminder({
          goalId: goal.id,
          type: subType || type,
          channel: 'voice',
          locale: voice.locale,
          message: voice.script,
          scheduledAt: timestamp,
          metadata: { ...metadata, estimatedDurationSec: voice.durationSec },
        }),
      );
    }

    if (reminders.length && this.auditLogger) {
      this.auditLogger.log(`recommendation:${subType || type}`, {
        goalId: goal.id,
        context: metadata,
      });
    }

    return reminders;
  }

  _recommendAmount(goal, incomeAmount) {
    const remaining = Math.max(goal.targetAmount - this.store.getProgressAmount(goal.id), 0);
    if (remaining <= 0) {
      return 0;
    }
    const suggested = Math.max(100, Math.round(incomeAmount * 0.3));
    const rounded = Math.ceil(suggested / 10) * 10;
    return Math.min(remaining, rounded);
  }
}

module.exports = { ReminderEngine };
