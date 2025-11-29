class CashflowModule {
  handle({ entities = {}, prompt }) {
    const duration = entities.durations?.[0] || 'this month';
    return `Cashflow focus for ${duration}. ${prompt ? `Context ${prompt}` : ''}`.trim();
  }
}

module.exports = { CashflowModule };
