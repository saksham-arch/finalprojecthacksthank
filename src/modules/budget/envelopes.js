const REQUIRED_ENVELOPES = ['food', 'travel', 'bachatDabba', 'festivalPot'];

function computeVariability(history = []) {
  if (!Array.isArray(history) || history.length < 2) {
    return 0;
  }

  const values = history.filter((value) => typeof value === 'number' && value > 0);
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  if (mean === 0) {
    return 0;
  }

  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  const stdDeviation = Math.sqrt(variance);
  return +(stdDeviation / mean).toFixed(2);
}

function normalizeWeights(weights) {
  const total = Object.values(weights).reduce((acc, value) => acc + value, 0);
  const normalized = {};
  REQUIRED_ENVELOPES.forEach((key) => {
    normalized[key] = +(weights[key] / total).toFixed(4);
  });
  return normalized;
}

function deriveEnvelopeWeights({ incomeHistory = [], festivalPhase = { phase: 'none' } } = {}) {
  const variability = computeVariability(incomeHistory);
  const baseWeights = {
    food: 0.38,
    travel: 0.17,
    bachatDabba: 0.25,
    festivalPot: 0.2
  };

  if (variability >= 0.4) {
    baseWeights.bachatDabba += 0.07;
    baseWeights.travel -= 0.03;
    baseWeights.food -= 0.02;
    baseWeights.festivalPot -= 0.02;
  } else if (variability <= 0.15) {
    baseWeights.food += 0.02;
    baseWeights.travel += 0.02;
    baseWeights.bachatDabba -= 0.03;
    baseWeights.festivalPot -= 0.01;
  }

  if (festivalPhase.phase === 'pre' || festivalPhase.phase === 'during') {
    baseWeights.bachatDabba += 0.04;
    baseWeights.festivalPot += 0.04;
    baseWeights.travel -= 0.02;
  } else if (festivalPhase.phase === 'post') {
    baseWeights.bachatDabba -= 0.03;
    baseWeights.festivalPot -= 0.02;
    baseWeights.food += 0.03;
  }

  REQUIRED_ENVELOPES.forEach((key) => {
    baseWeights[key] = Math.max(baseWeights[key], 0.05);
  });

  return {
    variability,
    weights: normalizeWeights(baseWeights)
  };
}

module.exports = {
  REQUIRED_ENVELOPES,
  computeVariability,
  deriveEnvelopeWeights
};
