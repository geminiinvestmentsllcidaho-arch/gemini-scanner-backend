import {
  evaluatePaperTradeBrokerAdapterGuard,
  readPaperTradeBrokerAdapterGuardPanel
} from '../src/scanner/paper_trade_broker_adapter_guard.mjs';

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

const ticket =
  args.symbol || args.side || args.qty
    ? {
        symbol: args.symbol,
        side: args.side,
        qty: args.qty,
        type: args.type || 'market',
        time_in_force: args.timeInForce || 'day'
      }
    : null;

const input = { orderTicket: ticket };

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradeBrokerAdapterGuardPanel(input)
    : evaluatePaperTradeBrokerAdapterGuard(input);

console.log(JSON.stringify(result, null, 2));
