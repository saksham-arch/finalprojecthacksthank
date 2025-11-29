class PlanHistoryStore {
  constructor() {
    this.entries = new Map();
  }

  persist(userId, plan) {
    if (!userId) {
      return null;
    }

    const sanitized = {
      savedAt: new Date().toISOString(),
      allocations: plan.allocations,
      guidanceType: plan.guidance.type,
      meta: {
        locale: plan.meta.locale,
        interactionCount: plan.meta.interactionCount,
        festivalPhase: plan.meta.festivalPhase,
        disclosure: plan.meta.disclosure
      }
    };

    const history = this.entries.get(userId) || [];
    history.push(sanitized);
    this.entries.set(userId, history);
    return sanitized;
  }

  find(userId) {
    return this.entries.get(userId) || [];
  }

  dump() {
    return Array.from(this.entries.entries()).reduce((acc, [userId, records]) => {
      acc[userId] = records;
      return acc;
    }, {});
  }

  clear() {
    this.entries.clear();
  }
}

function createHistoryStore() {
  return new PlanHistoryStore();
}

module.exports = {
  PlanHistoryStore,
  createHistoryStore
};
