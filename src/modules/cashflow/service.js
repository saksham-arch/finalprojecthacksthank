const { DEFAULT_OPTIONS, getBaseline } = require('./constants');
const { buildForecastSeries } = require('./forecaster');
const {
  recordCashflowPrediction,
  recordAudit,
  enqueueOfflineJob,
  markAlertTimestamp,
  getLastAlertTimestamp
} = require('./datastore');
const { startOfDay } = require('./date-utils');
const { buildGapSmsMessage, buildVoiceSummaryPayload } = require('./alerts');

class CashflowService {
  constructor(options = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  forecast({
    userId,
    gigType,
    region,
    history = [],
    referenceDate = new Date(),
    horizonDays
  }) {
    if (!userId) {
      throw new Error('userId is required');
    }

    const baselineValue = getBaseline(gigType, region);
    const normalizedReference = startOfDay(referenceDate);
    const horizon = horizonDays || this.options.horizonDays;

    const { predictions } = buildForecastSeries({
      history,
      referenceDate: normalizedReference,
      horizonDays: horizon,
      baselineValue,
      historyThreshold: this.options.historyThreshold
    });

    const storedPredictions = predictions.map((prediction) => {
      const entry = {
        userId,
        date: prediction.date.toISOString(),
        amount: prediction.amount,
        scenario: prediction.scenario,
        adjustments: prediction.adjustments.map((adj) => ({ ...adj })),
        explanation: prediction.explanation,
        confidence: prediction.confidence
      };
      recordCashflowPrediction(entry);
      recordAudit({
        userId,
        timestamp: new Date().toISOString(),
        action: 'cashflow_prediction',
        details: {
          date: entry.date,
          amount: entry.amount,
          confidence: entry.confidence,
          scenario: entry.scenario
        }
      });
      return entry;
    });

    const alertResult = this.handleIncomeGapAlerts({
      userId,
      referenceDate: normalizedReference,
      predictions: storedPredictions
    });

    return {
      predictions: storedPredictions,
      alerts: alertResult.triggered ? ['income-gap'] : []
    };
  }

  handleIncomeGapAlerts({ userId, referenceDate, predictions }) {
    const total48h = predictions
      .slice(0, 2)
      .reduce((sum, item) => sum + item.amount, 0);

    if (total48h >= this.options.incomeGapThreshold) {
      return { triggered: false };
    }

    const lastAlertTimestamp = getLastAlertTimestamp(userId);
    const fortyEightHours = 48 * 60 * 60 * 1000;
    if (lastAlertTimestamp && referenceDate.getTime() - lastAlertTimestamp < fortyEightHours) {
      return { triggered: false };
    }

    const smsMessage = buildGapSmsMessage({
      total48h,
      threshold: this.options.incomeGapThreshold
    });

    enqueueOfflineJob({
      type: 'SMS',
      channel: 'sms',
      userId,
      payload: {
        message: smsMessage,
        cadence: '48h'
      }
    });

    const voicePayload = buildVoiceSummaryPayload({
      total48h,
      predictions
    });

    enqueueOfflineJob({
      type: 'VOICE',
      channel: 'voice',
      userId,
      payload: {
        script: voicePayload.script,
        durationSeconds: voicePayload.durationSeconds,
        wordCount: voicePayload.wordCount,
        cadence: '48h'
      }
    });

    markAlertTimestamp(userId, referenceDate);
    return { triggered: true };
  }
}

module.exports = CashflowService;
