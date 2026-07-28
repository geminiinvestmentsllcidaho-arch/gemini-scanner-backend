export const VERSION = "customer_zero_readonly_allocation_preview_v1";

export const FIRST_MANUAL_PAPER_TRADE_TEST_POLICY = Object.freeze({
  id: "first_manual_paper_trade_test_v1",
  mode: "paper_only_readonly",
  sizingBase: "paper_equity",
  targetAllocationPct: 0.25,
  hardDollarCap: 250,
  wholeSharesOnly: true,
  maxConcurrentTestPositions: 1,
  averagingDownAllowed: false,
  leverageAllowed: false,
  requiresManualOperatorSubmission: true,
});

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function money(value) {
  return Number(Math.max(0, value).toFixed(2));
}

export function buildCustomerZeroReadonlyAllocationPreview(candidate = {}, options = {}) {
  const price = finite(candidate?.price);
  const paperEquity = finite(
    options?.equity
      ?? options?.paperEquity
      ?? options?.accountEquity,
  );
  const buyingPower = finite(options?.buyingPower);
  const requestedFundsPct = finite(options?.availableFundsPct);
  const availableFundsPct = clamp(requestedFundsPct ?? FIRST_MANUAL_PAPER_TRADE_TEST_POLICY.targetAllocationPct, 0, 80);
  const requestedMaxDollars = finite(options?.maxDollarsPerStock);
  const maxDollarsPerStock = requestedMaxDollars !== null && requestedMaxDollars > 0
    ? requestedMaxDollars
    : FIRST_MANUAL_PAPER_TRADE_TEST_POLICY.hardDollarCap;

  const percentageLimit = paperEquity !== null
    ? money(paperEquity * (availableFundsPct / 100))
    : null;

  const scannerRiskLimit = finite(candidate?.scannerRiskLimitDollars)
    ?? finite(candidate?.rankingSetupScore)
    ?? null;
  const portfolioExposureLimit = finite(candidate?.portfolioExposureLimitDollars);
  const liquidityCapacityLimit = finite(candidate?.liquidityCapacityLimitDollars);

  const limits = [
    percentageLimit,
    maxDollarsPerStock,
    paperEquity,
    buyingPower,
    scannerRiskLimit,
    portfolioExposureLimit,
    liquidityCapacityLimit,
  ].filter((value) => value !== null && value >= 0);

  const finalNotional = paperEquity !== null && limits.length
    ? money(Math.min(...limits))
    : 0;
  const estimatedWholeShares = price && price > 0
    ? Math.max(0, Math.floor(finalNotional / price))
    : 0;
  const estimatedOrderNotional = price && estimatedWholeShares > 0
    ? money(estimatedWholeShares * price)
    : 0;

  const stale = candidate?.sourceStale === true || candidate?.resultState === "STALE_DATA";
  const previewReady = !stale && price !== null && price > 0 && estimatedWholeShares > 0;

  const warnings = [];
  if (paperEquity === null) warnings.push("PAPER_EQUITY_UNAVAILABLE");
  if (buyingPower === null) warnings.push("BUYING_POWER_UNAVAILABLE");
  if (requestedFundsPct !== null && requestedFundsPct > 80) warnings.push("AVAILABLE_FUNDS_PCT_CAPPED_AT_80");
  if (requestedMaxDollars !== null && requestedMaxDollars <= 0) warnings.push("MAX_DOLLARS_INVALID");
  if (buyingPower !== null && maxDollarsPerStock > buyingPower) warnings.push("MAX_DOLLARS_EXCEEDS_BUYING_POWER");
  if (stale) warnings.push("STALE_DATA_BLOCKED");
  if (!(price > 0)) warnings.push("PRICE_UNAVAILABLE");
  if (estimatedWholeShares <= 0) warnings.push("WHOLE_SHARE_QUANTITY_ZERO");

  return {
    version: VERSION,
    allocationPolicy: FIRST_MANUAL_PAPER_TRADE_TEST_POLICY,
    allocationPolicyId: FIRST_MANUAL_PAPER_TRADE_TEST_POLICY.id,
    sizingBase: FIRST_MANUAL_PAPER_TRADE_TEST_POLICY.sizingBase,
    targetAllocationPct: availableFundsPct,
    hardDollarCap: money(maxDollarsPerStock),
    symbol: String(candidate?.symbol ?? "").toUpperCase(),
    readOnly: true,
    previewOnly: true,
    executionAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    controls: {
      availableFundsPct,
      availableFundsPctMin: 0,
      availableFundsPctMax: 80,
      availableFundsPctStep: 5,
      maxDollarsPerStock: money(maxDollarsPerStock),
      maxDollarsStep: 5,
    },
    limits: {
      percentageLimit,
      maxDollarsPerStock: money(maxDollarsPerStock),
      paperEquity,
      buyingPower,
      scannerRiskLimit,
      portfolioExposureLimit,
      liquidityCapacityLimit,
    },
    preview: {
      price,
      finalNotional,
      estimatedWholeShares,
      estimatedOrderNotional,
      ready: previewReady,
    },
    warnings,
  };
}

export default {
  VERSION,
  FIRST_MANUAL_PAPER_TRADE_TEST_POLICY,
  buildCustomerZeroReadonlyAllocationPreview,
};
