class GoalModule {
  handle({ entities = {}, prompt }) {
    const duration = entities.durations?.[0] || 'next 12 months';
    return `Goal tracker: align milestones for ${duration}. ${prompt ? `Context ${prompt}` : ''}`.trim();
  }
}

module.exports = { GoalModule };
