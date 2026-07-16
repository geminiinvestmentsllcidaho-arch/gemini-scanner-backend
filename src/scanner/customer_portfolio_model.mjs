export const VERSION = "customer_portfolio_model_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round2(value) {
  const number = finite(value);
  return number === null ? null : Number(number.toFixed(2));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function buildCustomerPortfolioModel(options = {}) {
  const paperAccount = options.paperAccount ?? {};
  const account = paperAccount.account ?? {};
  const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
  const sourceTs = options.sourceTs ?? null;
  const sourceMs = sourceTs ? Date.parse(sourceTs) : Number.NaN;
  const sourceAgeSec = Number.isFinite(sourceMs)
    ? Math.max(0, Math.floor((now.getTime() - sourceMs) / 1000))
    : null;
  const maxAgeSec = finite(options.maxAgeSec) ?? 120;
  const stale = sourceAgeSec === null || sourceAgeSec > maxAgeSec;

  const positions = list(paperAccount.positions)
    .map((position) => {
      const qty = finite(position?.qty);
      const averageEntryPrice = finite(position?.averageEntryPrice);
      const currentPrice = finite(position?.currentPrice);
      const costBasis = qty !== null && averageEntryPrice !== null
        ? qty * averageEntryPrice
        : null;
      const marketValue = finite(position?.marketValue)
        ?? (qty !== null && currentPrice !== null ? qty * currentPrice : null);
      const unrealizedPl = finite(position?.unrealizedPl)
        ?? (marketValue !== null && costBasis !== null ? marketValue - costBasis : null);
      const rawPct = finite(position?.unrealizedPlpc);

      return {
        symbol: String(position?.symbol ?? "").trim().toUpperCase(),
        qty: round2(qty),
        averageEntryPrice: round2(averageEntryPrice),
        currentPrice: round2(currentPrice),
        costBasis: round2(costBasis),
        marketValue: round2(marketValue),
        unrealizedPl: round2(unrealizedPl),
        unrealizedPlPct: rawPct !== null
          ? Number((rawPct * 100).toFixed(2))
          : (costBasis > 0 && unrealizedPl !== null
            ? Number(((unrealizedPl / costBasis) * 100).toFixed(2))
            : null),
        side: position?.side ?? null,
        allocationPct: null,
        missingPrice: currentPrice === null,
      };
    })
    .filter((position) => position.symbol)
    .sort((a, b) => (b.marketValue ?? -Infinity) - (a.marketValue ?? -Infinity));

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
  const portfolioValue = round2(account.portfolioValue ?? account.equity);
  const allocationBase = portfolioValue > 0 ? portfolioValue : totalMarketValue;

  const allocatedPositions = positions.map((position) => ({
    ...position,
    allocationPct: allocationBase > 0 && position.marketValue !== null
      ? Number(((position.marketValue / allocationBase) * 100).toFixed(2))
      : null,
  }));

  const largestPosition = allocatedPositions[0] ?? null;
  const topWinner = [...allocatedPositions]
    .filter((position) => position.unrealizedPl !== null)
    .sort((a, b) => b.unrealizedPl - a.unrealizedPl)[0] ?? null;
  const topLoser = [...allocatedPositions]
    .filter((position) => position.unrealizedPl !== null)
    .sort((a, b) => a.unrealizedPl - b.unrealizedPl)[0] ?? null;

  const warnings = [];
  if (paperAccount.accountHealthy !== true) warnings.push("PAPER_ACCOUNT_UNHEALTHY");
  if (stale) warnings.push("PORTFOLIO_DATA_STALE");
  if (allocatedPositions.some((position) => position.missingPrice)) {
    warnings.push("POSITION_PRICE_MISSING");
  }
  if ((largestPosition?.allocationPct ?? 0) >= 25) {
    warnings.push("PORTFOLIO_CONCENTRATION_HIGH");
  }

  return Object.freeze({
    version: VERSION,
    route: "/customer/portfolio",
    status: paperAccount.accountHealthy === true && !stale
      ? "current_readonly"
      : "stale_readonly",
    stale,
    sourceTs,
    sourceAgeSec,
    account: Object.freeze({
      cash: round2(account.cash),
      buyingPower: round2(account.buyingPower),
      equity: round2(account.equity),
      portfolioValue,
      accountStatus: account.accountStatus ?? "unknown",
      currency: account.currency ?? "USD",
    }),
    summary: Object.freeze({
      positionsCount: allocatedPositions.length,
      investedCapital: totalCostBasis,
      availableCapital: round2(account.cash),
      totalExposure: totalMarketValue,
      totalMarketValue,
      totalCostBasis,
      totalUnrealizedPl,
      totalUnrealizedPlPct: totalCostBasis > 0
        ? Number(((totalUnrealizedPl / totalCostBasis) * 100).toFixed(2))
        : null,
      averagePositionSize: allocatedPositions.length
        ? round2(totalMarketValue / allocatedPositions.length)
        : null,
      largestPosition,
      topWinner,
      topLoser,
    }),
    positions: Object.freeze(allocatedPositions),
    warnings: Object.freeze(warnings),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
}

export default { VERSION, buildCustomerPortfolioModel };
