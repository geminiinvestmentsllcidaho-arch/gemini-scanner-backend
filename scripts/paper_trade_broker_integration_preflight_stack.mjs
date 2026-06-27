import {
  evaluatePaperTradeBrokerIntegrationPreflightStack,
  readPaperTradeBrokerIntegrationPreflightStackPanel
} from '../src/scanner/paper_trade_broker_integration_preflight_stack.mjs';

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

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradeBrokerIntegrationPreflightStackPanel()
    : evaluatePaperTradeBrokerIntegrationPreflightStack();

console.log(JSON.stringify(result, null, 2));
