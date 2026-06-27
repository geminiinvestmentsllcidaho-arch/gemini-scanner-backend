import {
  buildPaperTradeSizingPreview,
  buildPaperTradeSizingPreviewPanel
} from '../src/scanner/paper_trade_sizing_preview.mjs';

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
  paperEquity: args.paperEquity,
  riskPct: args.riskPct,
  stopPct: args.stopPct,
  maxNotionalPct: args.maxNotionalPct
};

const result =
  args.panel === true || args.panel === 'true'
    ? buildPaperTradeSizingPreviewPanel(options)
    : buildPaperTradeSizingPreview(options);

console.log(JSON.stringify(result, null, 2));
