import {
  previewPaperTradeIntentCreationFromPlan,
  runPaperTradeIntentCreation
} from '../src/scanner/paper_trade_intent_creation_runner.mjs';

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
  ledgerPath: args.ledgerPath
};

const result =
  args.preview === true || args.preview === 'true'
    ? previewPaperTradeIntentCreationFromPlan(undefined, options)
    : runPaperTradeIntentCreation(options);

console.log(JSON.stringify(result, null, 2));
