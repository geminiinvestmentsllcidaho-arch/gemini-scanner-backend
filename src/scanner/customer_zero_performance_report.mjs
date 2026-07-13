export const VERSION = "customer_zero_performance_report_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function round2(value) {
  return Number(finite(value).toFixed(2));
}

function tone(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

export function buildCustomerZeroPerformanceReport(options = {}) {
  const paperAccount = options.paperAccount ?? {};
  const paperLedger = options.paperLedger ?? {};
  const period = String(options.period ?? "daily").toLowerCase();
  const realizedPl = round2(paperLedger.totalRealizedPnl);
  const unrealizedPl = round2(paperAccount?.summary?.totalUnrealizedPl);
  const totalPl = round2(realizedPl + unrealizedPl);
  const sourceTs = options.sourceTs ?? null;
  const stale = options.stale === true || !sourceTs;

  return {
    version: VERSION,
    period,
    realizedPl,
    unrealizedPl,
    totalPl,
    tone: tone(totalPl),
    sourceTs,
    stale,
    status: stale ? "stale_readonly" : "current_readonly",
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    scannerEstimateUsed: false,
    brokerOrPaperLedgerOnly: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };
}

export default { VERSION, buildCustomerZeroPerformanceReport };
