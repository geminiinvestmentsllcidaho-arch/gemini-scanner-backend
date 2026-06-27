import {
  DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH,
  PAPER_TRADE_INTENT_CREATION_STORE_VERSION,
  readPaperTradeIntentCreationRecords
} from './paper_trade_intent_creation_store.mjs';

export const PAPER_TRADE_INTENT_CREATION_DASHBOARD_VERSION =
  'paper_trade_intent_creation_dashboard_v1';

export function readPaperTradeIntentCreationDashboard(options = {}) {
  const ledgerPath =
    options.ledgerPath || DEFAULT_PAPER_TRADE_INTENT_CREATION_LEDGER_PATH;

  const records = readPaperTradeIntentCreationRecords(ledgerPath);
  const latestRecord = records.length ? records[records.length - 1] : null;

  return {
    ok: true,
    version: PAPER_TRADE_INTENT_CREATION_DASHBOARD_VERSION,
    storeVersion: PAPER_TRADE_INTENT_CREATION_STORE_VERSION,
    monitorOnly: true,
    ledgerPath,
    recordCount: records.length,
    hasRecords: records.length > 0,
    latestRecord,
    latestStatus: latestRecord ? 'created' : 'empty',
    safety: {
      orderPlacement: false,
      liveTrading: false,
      autoTrading: false,
      brokerExecution: false,
      accountMutation: false,
      brokerContact: false,
      localJsonlOnly: true
    }
  };
}
