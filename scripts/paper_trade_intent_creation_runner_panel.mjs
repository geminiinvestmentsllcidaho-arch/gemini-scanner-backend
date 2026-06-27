import { readPaperTradeIntentCreationRunnerPanel } from '../src/scanner/paper_trade_intent_creation_runner_panel.mjs';

const result = readPaperTradeIntentCreationRunnerPanel();
console.log(JSON.stringify(result, null, 2));
