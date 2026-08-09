export const VERSION = "customer_zero_paper_account_bridge_v1";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function buildCustomerZeroPaperAccountBridge(fetchResult = {}, options = {}) {
  const connected = fetchResult?.status === "connected_readonly";
  const account = fetchResult?.account ?? {};
  const positions = list(fetchResult?.positions).map((position) => ({
    symbol: String(position?.symbol ?? "").toUpperCase(),
    qty: finite(position?.qty),
    marketValue: finite(position?.marketValue),
    averageEntryPrice: finite(position?.averageEntryPrice),
    currentPrice: finite(position?.currentPrice),
    unrealizedPl: finite(position?.unrealizedPl),
    unrealizedPlpc: finite(position?.unrealizedPlpc),
    side: position?.side ?? null,
  }));
  const accountHealthy = connected
    && account?.accountStatus === "ACTIVE"
    && account?.tradingBlocked !== true
    && account?.accountBlocked !== true
    && finite(account?.buyingPower) !== null;

  const issues = [];
  if (!connected) issues.push("PAPER_ACCOUNT_NOT_CONNECTED");
  if (connected && account?.accountStatus !== "ACTIVE") issues.push("PAPER_ACCOUNT_NOT_ACTIVE");
  if (account?.tradingBlocked === true) issues.push("PAPER_TRADING_BLOCKED");
  if (account?.accountBlocked === true) issues.push("PAPER_ACCOUNT_BLOCKED");
  if (finite(account?.buyingPower) === null) issues.push("PAPER_BUYING_POWER_UNAVAILABLE");

  return {
    version: VERSION,
    connected,
    accountHealthy,
    status: accountHealthy ? "connected_readonly" : "blocked_readonly",
    displayState: accountHealthy
      ? "CUSTOMER_ZERO_PAPER_ACCOUNT_CONNECTED_READONLY"
      : "CUSTOMER_ZERO_PAPER_ACCOUNT_BLOCKED_READONLY",
    account: {
      cash: finite(account?.cash),
      buyingPower: finite(account?.buyingPower),
      equity: finite(account?.equity),
      portfolioValue: finite(account?.portfolioValue),
      currency: account?.currency ?? "USD",
      accountStatus: account?.accountStatus ?? "unknown",
      patternDayTrader: account?.patternDayTrader === true,
      tradingBlocked: account?.tradingBlocked === true,
      accountBlocked: account?.accountBlocked === true,
    },
    positions,
    summary: {
      positionsCount: positions.length,
      totalMarketValue: finite(fetchResult?.summary?.totalMarketValue) ?? 0,
      totalUnrealizedPl: finite(fetchResult?.summary?.totalUnrealizedPl) ?? 0,
      operatorMessage: fetchResult?.summary?.operatorMessage ?? null,
    },
    issues,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  };
}

export default {
  VERSION,
  buildCustomerZeroPaperAccountBridge,
};
