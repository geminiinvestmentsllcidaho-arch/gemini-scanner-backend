import {
  buildPaperTradeExecutionPayloadPreview,
  buildPaperTradeExecutionPayloadPreviewPanel
} from '../src/scanner/paper_trade_execution_payload_preview.mjs';

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
const options = { ledgerPath: args.ledgerPath };

const result =
  args.panel === true || args.panel === 'true'
    ? buildPaperTradeExecutionPayloadPreviewPanel(options)
    : buildPaperTradeExecutionPayloadPreview(options);

console.log(JSON.stringify(result, null, 2));
