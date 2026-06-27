import {
  readPaperTradePositionStateStoreDashboard,
  storePaperTradePositionState
} from '../src/scanner/paper_trade_position_state_store.mjs';
import { readPaperTradePositionStateStorePanel } from '../src/scanner/paper_trade_position_state_store_panel.mjs';

function parseArgs(argv) {
  const out = {};

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...rest] = arg.slice(2).split('=');
    out[key] = rest.length ? rest.join('=') : true;
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));

const options = {
  fillLedgerPath: args.fillLedgerPath,
  sourceLedgerPath: args.sourceLedgerPath,
  storeLedgerPath: args.storeLedgerPath,
  positionLedgerPath: args.positionLedgerPath,
  ledgerPath: args.ledgerPath
};

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradePositionStateStorePanel(options)
    : args.dashboard === true || args.dashboard === 'true'
      ? readPaperTradePositionStateStoreDashboard(options)
      : storePaperTradePositionState(options);

console.log(JSON.stringify(result, null, 2));
