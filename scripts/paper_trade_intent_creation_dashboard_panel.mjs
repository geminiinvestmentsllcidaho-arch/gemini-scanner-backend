import { readPaperTradeIntentCreationDashboardPanel } from '../src/scanner/paper_trade_intent_creation_dashboard_panel.mjs';

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
const result = readPaperTradeIntentCreationDashboardPanel({
  ledgerPath: args.ledgerPath
});

console.log(JSON.stringify(result, null, 2));
