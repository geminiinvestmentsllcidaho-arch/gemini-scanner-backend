import {
  readPaperTradeLifecycleDashboard,
  readPaperTradeLifecycleDashboardPanel
} from '../src/scanner/paper_trade_lifecycle_dashboard.mjs';

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
  intentLedgerPath: args.intentLedgerPath,
  ticketLedgerPath: args.ticketLedgerPath,
  fillLedgerPath: args.fillLedgerPath,
  positionLedgerPath: args.positionLedgerPath
};

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradeLifecycleDashboardPanel(options)
    : readPaperTradeLifecycleDashboard(options);

console.log(JSON.stringify(result, null, 2));
