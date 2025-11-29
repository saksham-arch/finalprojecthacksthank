class GoalRouter {
  constructor({ service }) {
    if (!service) {
      throw new Error('GoalService instance is required');
    }
    this.service = service;
  }

  handle(request) {
    const { method, path, body = {} } = request;
    try {
      if (method === 'POST' && path === '/goals') {
        const goal = this.service.createGoal(body);
        return { statusCode: 201, body: { data: goal } };
      }

      if (method === 'POST' && path === '/goals/recovery/check') {
        const reminders = this.service.runRecovery({ currentDate: body.currentDate });
        return { statusCode: 200, body: { data: reminders } };
      }

      const progressMatch = method === 'POST' ? path.match(/^\/goals\/(.+)\/progress$/) : null;
      if (progressMatch) {
        const goalId = progressMatch[1];
        const result = this.service.logProgress({
          goalId,
          amount: body.amount,
          timestamp: body.timestamp,
          locale: body.locale,
        });
        return { statusCode: 200, body: { data: result } };
      }

      const incomeMatch = method === 'POST' ? path.match(/^\/goals\/(.+)\/income$/) : null;
      if (incomeMatch) {
        const goalId = incomeMatch[1];
        const reminders = this.service.registerIncomeEvent({
          goalId,
          incomeAmount: body.incomeAmount,
          timestamp: body.timestamp,
          locale: body.locale,
        });
        return { statusCode: 202, body: { data: reminders } };
      }

      return { statusCode: 404, body: { error: 'Route not found' } };
    } catch (error) {
      return this._handleError(error);
    }
  }

  _handleError(error) {
    if (error.message && error.message.includes('not found')) {
      return { statusCode: 404, body: { error: error.message } };
    }
    if (error instanceof RangeError) {
      return { statusCode: 422, body: { error: error.message } };
    }
    return { statusCode: 400, body: { error: error.message } };
  }
}

module.exports = { GoalRouter };
