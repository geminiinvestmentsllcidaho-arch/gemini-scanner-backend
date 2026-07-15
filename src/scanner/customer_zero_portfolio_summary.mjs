export const VERSION = "customer_zero_portfolio_summary_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(2));
}

function pct(value) {
  const number = finite(value);
  return number === null ? null : Number((number * 100).toFixed(2));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function tone(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

export function buildCustomerZeroPortfolioSummary(options = {}) {
  const paperAccount = options.paperAccount ?? {};
  const account = paperAccount.account ?? {};
  const positions = list(paperAccount.positions)
    .map((position) => {
      const qty = finite(position?.qty);
      const averageEntryPrice = finite(position?.averageEntryPrice);
      const currentPrice = finite(position?.currentPrice);
      const marketValue = finite(position?.marketValue)
        ?? (qty !== null && currentPrice !== null ? qty * currentPrice : null);
      const costBasis = qty !== null && averageEntryPrice !== null
        ? qty * averageEntryPrice
        : null;
      const unrealizedPl = finite(position?.unrealizedPl)
        ?? (marketValue !== null && costBasis !== null ? marketValue - costBasis : null);
      const unrealizedPlpc = finite(position?.unrealizedPlpc)
        ?? (unrealizedPl !== null && costBasis > 0 ? unrealizedPl / costBasis : null);

      return {
        symbol: String(position?.symbol ?? "").trim().toUpperCase(),
        qty: round2(qty),
        averageEntryPrice: round2(averageEntryPrice),
        currentPrice: round2(currentPrice),
        costBasis: round2(costBasis),
        marketValue: round2(marketValue),
        unrealizedPl: round2(unrealizedPl),
        unrealizedPlPct: pct(unrealizedPlpc),
        tone: tone(unrealizedPl ?? 0),
        side: position?.side ?? null,
      };
    })
    .filter((position) => position.symbol);

  const totalMarketValue = round2(
    paperAccount?.summary?.totalMarketValue
      ?? positions.reduce((sum, position) => sum + (position.marketValue ?? 0), 0)
  ) ?? 0;
  const totalCostBasis = round2(
    positions.reduce((sum, position) => sum + (position.costBasis ?? 0), 0)
  ) ?? 0;
  const totalUnrealizedPl = round2(
    paperAccount?.summary?.totalUnrealizedPl
      ?? positions.reduce((sum, position) => sum + (position.unrealizedPl ?? 0), 0)
  ) ?? 0;

  return {
    version: VERSION,
    status: paperAccount.accountHealthy === true ? "connected_readonly" : "blocked_readonly",
    displayState: paperAccount.accountHealthy === true
      ? "CUSTOMER_ZERO_PORTFOLIO_CONNECTED_READONLY"
      : "CUSTOMER_ZERO_PORTFOLIO_BLOCKED_READONLY",
    account: {
      cash: round2(account.cash),
      buyingPower: round2(account.buyingPower),
      equity: round2(account.equity),
      portfolioValue: round2(account.portfolioValue),
      currency: account.currency ?? "USD",
      accountStatus: account.accountStatus ?? "unknown",
    },
    summary: {
      positionsCount: positions.length,
      totalCostBasis,
      totalMarketValue,
      totalUnrealizedPl,
      totalUnrealizedPlPct: totalCostBasis > 0
        ? Number(((totalUnrealizedPl / totalCostBasis) * 100).toFixed(2))
        : 0,
      tone: tone(totalUnrealizedPl),
    },
    positions,
    issues: list(paperAccount.issues),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };
}

export default { VERSION, buildCustomerZeroPortfolioSummary };
