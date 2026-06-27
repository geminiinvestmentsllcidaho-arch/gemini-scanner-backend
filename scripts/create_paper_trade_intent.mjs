import fs from 'node:fs';
import { createPaperTradeIntent } from '../src/scanner/paper_trade_intent_creation_store.mjs';

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

let input = {};
if (args.input) {
  input = JSON.parse(fs.readFileSync(args.input, 'utf8'));
} else {
  input = {
    readinessGateStatus: args.readiness || args.readinessGateStatus,
    readinessGateOk: args.readinessGateOk === 'true',
    canCreateIntent: args.canCreateIntent === 'true',
    symbol: args.symbol,
    candidateSymbol: args.candidateSymbol,
    action: args.action,
    entryPrice: args.entryPrice,
    source: args.source || 'cli'
  };
}

const result = createPaperTradeIntent(input, {
  ledgerPath: args.ledgerPath,
  source: args.source || input.source || 'cli'
});

console.log(JSON.stringify(result, null, 2));
