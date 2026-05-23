const { errorResult, okResult } = require('./result');

function createBudgetEnforcer({ maxEstimatedCost } = {}) {
  if (!Number.isFinite(maxEstimatedCost) || maxEstimatedCost < 0) {
    throw new Error('maxEstimatedCost must be a non-negative number');
  }

  return {
    check(totals = {}) {
      const estimatedCost = Number(totals.estimatedCost || 0);
      if (!Number.isFinite(estimatedCost) || estimatedCost > maxEstimatedCost) {
        return errorResult('BUDGET_EXCEEDED', 'Estimated cost exceeds configured budget', {
          estimatedCost,
          maxEstimatedCost
        });
      }
      return okResult({ estimatedCost, maxEstimatedCost });
    }
  };
}

module.exports = {
  createBudgetEnforcer
};
