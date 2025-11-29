const ROUTING_TABLE = {
  budget: 'budget',
  cashflow: 'cashflow',
  goal: 'goal',
};

function routeIntent(intent = 'budget', modules = {}) {
  const moduleKey = ROUTING_TABLE[intent] || ROUTING_TABLE.budget;
  const moduleHandler = modules[moduleKey];
  if (!moduleHandler) {
    throw new Error(`No module registered for intent ${moduleKey}`);
  }
  return moduleHandler;
}

module.exports = { ROUTING_TABLE, routeIntent };
