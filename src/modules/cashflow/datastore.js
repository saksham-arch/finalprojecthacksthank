const cashflowPredictions = [];
const auditLog = [];
const offlineQueue = [];
const lastAlertAt = new Map();

function recordCashflowPrediction(entry) {
  cashflowPredictions.push(entry);
}

function getCashflowPredictions() {
  return cashflowPredictions;
}

function recordAudit(entry) {
  auditLog.push(entry);
}

function getAuditLog() {
  return auditLog;
}

function enqueueOfflineJob(job) {
  const queued = {
    id: `${Date.now()}-${offlineQueue.length + 1}`,
    ...job
  };
  offlineQueue.push(queued);
  return queued;
}

function getOfflineQueue() {
  return offlineQueue;
}

function markAlertTimestamp(userId, timestamp) {
  lastAlertAt.set(userId, timestamp.getTime());
}

function getLastAlertTimestamp(userId) {
  const stored = lastAlertAt.get(userId);
  return typeof stored === 'number' ? stored : null;
}

function resetStores() {
  cashflowPredictions.length = 0;
  auditLog.length = 0;
  offlineQueue.length = 0;
  lastAlertAt.clear();
}

module.exports = {
  recordCashflowPrediction,
  getCashflowPredictions,
  recordAudit,
  getAuditLog,
  enqueueOfflineJob,
  getOfflineQueue,
  markAlertTimestamp,
  getLastAlertTimestamp,
  resetStores
};
