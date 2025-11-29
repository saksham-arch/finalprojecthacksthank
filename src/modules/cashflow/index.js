const CashflowService = require('./service');
const datastore = require('./datastore');
const constants = require('./constants');

module.exports = {
  CashflowService,
  constants,
  dataStores: {
    reset: datastore.resetStores,
    getCashflowPredictions: datastore.getCashflowPredictions,
    getAuditLog: datastore.getAuditLog,
    getOfflineQueue: datastore.getOfflineQueue
  }
};
