import {
  buildPaperTradeFillSimulationPreview,
  buildPaperTradeFillSimulationPreviewPanel
} from '../src/scanner/paper_trade_fill_simulation_preview.mjs';

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
  ledgerPath: args.ledgerPath,
  fillPrice: args.fillPrice,
  referencePrice: args.referencePrice,
  entryReferencePrice: args.entryReferencePrice
};

const result =
  args.panel === true || args.panel === 'true'
    ? buildPaperTradeFillSimulationPreviewPanel(options)
    : buildPaperTradeFillSimulationPreview(options);

console.log(JSON.stringify(result, null, 2));
