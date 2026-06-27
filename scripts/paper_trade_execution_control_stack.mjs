import {
  evaluatePaperTradeExecutionControlStack,
  readPaperTradeExecutionControlStackPanel
} from '../src/scanner/paper_trade_execution_control_stack.mjs';

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

const input = {
  operatorBrokerApproval: args.operatorBrokerApproval === 'true',
  paperExecutionEnabled: args.paperExecutionEnabled === 'true',
  killSwitchActive: args.killSwitchActive === 'true',
  duplicateTicketDetected: args.duplicateTicketDetected === 'true',
  requiredAuditComplete: args.requiredAuditComplete === 'true',
  marketSession: args.marketSession,
  dailyTradeCount: args.dailyTradeCount,
  currentExposurePct: args.currentExposurePct,
  orderTicket:
    args.symbol || args.side || args.qty
      ? {
          symbol: args.symbol,
          side: args.side,
          qty: args.qty,
          type: args.type || 'market',
          time_in_force: args.timeInForce || 'day',
          entryReferencePrice: args.entryReferencePrice,
          sourceIntentId: args.sourceIntentId,
          ticketId: args.ticketId
        }
      : null
};

const options = {
  maxQty: args.maxQty,
  maxNotional: args.maxNotional,
  dailyTradeLimit: args.dailyTradeLimit,
  maxExposurePct: args.maxExposurePct
};

const result =
  args.panel === true || args.panel === 'true'
    ? readPaperTradeExecutionControlStackPanel(input, options)
    : evaluatePaperTradeExecutionControlStack(input, options);

console.log(JSON.stringify(result, null, 2));
