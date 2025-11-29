const {
  FESTIVAL_CALENDAR,
  MONSOON_MONTHS,
  MONSOON_DAMPENING
} = require('./constants');
const {
  startOfDay,
  addDays,
  diffInDays,
  diffInMonths,
  clamp
} = require('./date-utils');

function buildForecastSeries({
  history = [],
  referenceDate,
  horizonDays,
  baselineValue,
  historyThreshold
}) {
  const normalizedReference = startOfDay(referenceDate);
  const seasonalAverages = computeSeasonalAverages(history, normalizedReference);
  const historyStrength = clamp(history.length / historyThreshold, 0, 1);
  const predictions = [];

  for (let i = 0; i < horizonDays; i += 1) {
    const targetDate = addDays(normalizedReference, i);
    const seasonalBase = getSeasonalBaseline(targetDate, seasonalAverages, baselineValue);
    const blendedBase = blendWithBaseline(seasonalBase, baselineValue, historyStrength);
    const { amount, adjustments } = applyTemporalModifiers(targetDate, blendedBase);
    const scenario = scenarioFromStrength(historyStrength);
    const confidence = computeConfidence(historyStrength, adjustments);
    const explanation = buildExplanation({ scenario, blendedBase, adjustments });

    predictions.push({
      date: targetDate,
      amount,
      adjustments,
      scenario,
      confidence,
      explanation
    });
  }

  return { predictions, historyStrength };
}

function computeSeasonalAverages(history, referenceDate) {
  if (!history.length) {
    return {};
  }

  const byMonth = {};
  let totalWeighted = 0;
  let totalWeight = 0;

  history.forEach((entry) => {
    if (typeof entry.amount !== 'number') {
      return;
    }
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const month = date.getMonth();
    const monthsDiff = Math.max(0, diffInMonths(referenceDate, date));
    const weight = 1 / (1 + monthsDiff / 3);

    if (!byMonth[month]) {
      byMonth[month] = { sum: 0, weight: 0 };
    }
    byMonth[month].sum += entry.amount * weight;
    byMonth[month].weight += weight;

    totalWeighted += entry.amount * weight;
    totalWeight += weight;
  });

  const seasonalAverages = {};
  if (totalWeight > 0) {
    seasonalAverages.overall = totalWeighted / totalWeight;
  }

  Object.keys(byMonth).forEach((month) => {
    const bucket = byMonth[month];
    if (bucket.weight > 0) {
      seasonalAverages[month] = bucket.sum / bucket.weight;
    }
  });

  return seasonalAverages;
}

function getSeasonalBaseline(date, seasonalAverages, fallback) {
  const month = date.getMonth();
  if (typeof seasonalAverages[month] === 'number') {
    return seasonalAverages[month];
  }
  if (typeof seasonalAverages.overall === 'number') {
    return seasonalAverages.overall;
  }
  return fallback;
}

function blendWithBaseline(seasonalValue, baselineValue, historyStrength) {
  if (typeof seasonalValue !== 'number') {
    return baselineValue;
  }
  return baselineValue + (seasonalValue - baselineValue) * historyStrength;
}

function applyTemporalModifiers(date, baseAmount) {
  let adjusted = baseAmount;
  const adjustments = [];
  const festivals = getFestivalMatches(date);

  festivals.forEach((festival) => {
    adjusted *= festival.modifier;
    adjustments.push({
      type: 'festival',
      name: festival.name,
      impact: formatModifierImpact(festival.modifier)
    });
  });

  if (isMonsoonMonth(date)) {
    adjusted *= MONSOON_DAMPENING;
    adjustments.push({
      type: 'monsoon',
      name: 'Monsoon dampening',
      impact: formatModifierImpact(MONSOON_DAMPENING)
    });
  }

  return {
    amount: roundCurrency(adjusted),
    adjustments
  };
}

function getFestivalMatches(date) {
  return FESTIVAL_CALENDAR.filter((festival) => {
    const festivalDate = new Date(date.getFullYear(), festival.month, festival.day);
    const distance = Math.abs(diffInDays(date, festivalDate));
    return distance <= festival.window;
  });
}

function isMonsoonMonth(date) {
  return MONSOON_MONTHS.includes(date.getMonth());
}

function scenarioFromStrength(historyStrength) {
  if (historyStrength >= 0.75) {
    return 'history-rich';
  }
  if (historyStrength >= 0.35) {
    return 'blended';
  }
  return 'cold-start';
}

function computeConfidence(historyStrength, adjustments) {
  let confidence = 0.35 + 0.6 * historyStrength;
  const hasFestival = adjustments.some((item) => item.type === 'festival');
  const hasMonsoon = adjustments.some((item) => item.type === 'monsoon');
  if (hasFestival) {
    confidence += 0.03;
  }
  if (hasMonsoon) {
    confidence -= 0.05;
  }
  return Number(clamp(confidence, 0.2, 0.95).toFixed(2));
}

function buildExplanation({ scenario, blendedBase, adjustments }) {
  const adjustmentSummary = adjustments.length
    ? adjustments.map((adj) => `${adj.name} ${adj.impact}`).join(', ')
    : 'no seasonal adjustments';
  const sourceDescription = scenario === 'cold-start'
    ? 'regional baseline blend'
    : 'seasonal weighted moving average';
  return `Scenario ${scenario}: base inflow ${Math.round(blendedBase)} via ${sourceDescription} with ${adjustmentSummary}.`;
}

function formatModifierImpact(modifier) {
  const percentage = Math.round((modifier - 1) * 100);
  const prefix = percentage > 0 ? '+' : '';
  return `${prefix}${percentage}%`;
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

module.exports = {
  buildForecastSeries,
  computeSeasonalAverages, // exported for potential reuse/testing
  applyTemporalModifiers
};
