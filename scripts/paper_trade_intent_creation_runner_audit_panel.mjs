import { readPaperTradeIntentCreationRunnerAuditPanel } from '../src/scanner/paper_trade_intent_creation_runner_audit_panel.mjs';

const result = readPaperTradeIntentCreationRunnerAuditPanel();
console.log(JSON.stringify(result, null, 2));
