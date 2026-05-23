function roundCurrency(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function createCostTracker() {
  const totals = {
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0
  };

  return {
    record({ inputTokens = 0, outputTokens = 0, inputTokenCost = 0, outputTokenCost = 0 } = {}) {
      if (![inputTokens, outputTokens, inputTokenCost, outputTokenCost].every((value) => Number.isFinite(value) && value >= 0)) {
        throw new Error('Cost tracker values must be finite non-negative numbers');
      }
      totals.inputTokens += inputTokens;
      totals.outputTokens += outputTokens;
      totals.estimatedCost = roundCurrency(
        totals.estimatedCost + (inputTokens / 1000) * inputTokenCost + (outputTokens / 1000) * outputTokenCost
      );
      return this.getTotals();
    },

    getTotals() {
      return { ...totals };
    }
  };
}

module.exports = {
  createCostTracker
};
