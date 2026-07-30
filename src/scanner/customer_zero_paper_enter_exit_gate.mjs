export const VERSION = "customer_zero_paper_enter_exit_gate_v1";

function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value) {
  return value === true;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function findPosition(paperAccount = {}, symbol = "") {
  const target = String(symbol ?? "").trim().toUpperCase();
  return list(paperAccount.positions).find(
    (position) => String(position?.symbol ?? "").trim().toUpperCase() === target,
  ) ?? null;
}

export function buildCustomerZeroPaperEnterExitGate(candidate = {}, options = {}) {
  const state = String(candidate?.resultState ?? candidate?.decision ?? "NO_SETUP").toUpperCase();
  const symbol = String(candidate?.symbol ?? "").trim().toUpperCase();
  const price = finite(candidate?.price);
  const sourceAgeSec = finite(candidate?.sourceAgeSec);
  const paperAccount = options.paperAccount ?? {};
  const allocationPreview = options.allocationPreview ?? candidate?.allocationPreview ?? {};
  const position = findPosition(paperAccount, symbol);
  const openPositionCount = list(paperAccount.positions)
    .filter((item) => (finite(item?.qty) ?? 0) > 0)
    .length;
  const maxConcurrentTestPositions =
    finite(allocationPreview?.allocationPolicy?.maxConcurrentTestPositions)
    ?? finite(options.maxConcurrentTestPositions)
    ?? 1;
  const concurrentPositionCapacityAvailable =
    openPositionCount < Math.max(1, Math.trunc(maxConcurrentTestPositions));
  const marketOpen = bool(options.marketOpen);
  const paperExecutionEnabled = bool(options.paperExecutionEnabled);
  const operatorApproved = bool(options.operatorApproved);
  const killSwitchClear = options.killSwitchActive === false;
  const duplicateOrderClear = options.duplicateOrderDetected !== true;
  const priceDeviationOk = options.priceDeviationOk === true;
  const spreadLiquidityOk = options.spreadLiquidityOk === true;
  const accountHealthy = paperAccount?.accountHealthy === true;
  const freshQuote = price !== null && candidate?.sourceStale !== true;
  const freshSignal = sourceAgeSec !== null && sourceAgeSec <= Number(options.maxSourceAgeSec ?? 600);
  const allocationReady = allocationPreview?.preview?.ready === true;
  const portfolioWindDownActive = options.portfolioWindDownActive === true;
  const wholeShares = finite(allocationPreview?.preview?.estimatedWholeShares) ?? 0;
  const firstTestQuantity = wholeShares > 0 ? 1 : 0;
  const firstTestEstimatedCost = price !== null && firstTestQuantity > 0
    ? Number((price * firstTestQuantity).toFixed(2))
    : 0;
  const positionQty = finite(position?.qty) ?? 0;
  const exitConfirmationRequired = state === "EXIT";
  const baseChecks = {
    paperExecutionEnabled,
    operatorApproved,
    killSwitchClear,
    marketOpen,
    accountHealthy,
    freshQuote,
    freshSignal,
    duplicateOrderClear,
    priceDeviationOk,
    spreadLiquidityOk,
  };
  const enterChecks = {
    ...baseChecks,
    enterState: state === "ENTER",
    portfolioWindDownInactive: !portfolioWindDownActive,
    concurrentPositionCapacityAvailable,
    allocationReady,
    sufficientQuantity: wholeShares > 0,
  };
  const exitChecks = {
    ...baseChecks,
    exitState: state === "EXIT",
    positionPresent: positionQty > 0,
    exitConfirmationRequired,
  };
  const enterBlockedReasons = Object.entries(enterChecks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key);
  const exitBlockedReasons = Object.entries(exitChecks)
    .filter(([, passed]) => passed !== true)
    .map(([key]) => key);
  const enterReady = enterBlockedReasons.length === 0;
  const exitReady = exitBlockedReasons.length === 0;

  return {
    ok: true,
    version: VERSION,
    symbol,
    state,
    position,
    portfolioWindDownActive,
    positionPolicy: {
      openPositionCount,
      maxConcurrentTestPositions: Math.max(1, Math.trunc(maxConcurrentTestPositions)),
      capacityAvailable: concurrentPositionCapacityAvailable,
    },
    enter: {
      visible: state === "ENTER",
      label: "ENTER / BUY",
      style: enterReady ? "bright_green" : "disabled_gray",
      ready: enterReady,
      confirmationRequired: true,
      quantityPreview: firstTestQuantity,
      firstTestQuantity,
      firstTestEstimatedCost,
      suggestedQuantity: wholeShares,
      temporaryOneShareTestLimit: true,
      blockedReasons: enterBlockedReasons,
      checks: enterChecks,
    },
    exit: {
      visible: state === "EXIT" && positionQty > 0,
      label: "EXIT",
      style: "priority_red",
      priority: "highest",
      ready: exitReady,
      confirmationRequired: true,
      quantityPreview: positionQty,
      blockedReasons: exitBlockedReasons,
    },
    safety: {
      paperOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      previewOnly: true,
      decisionAssistOnly: true,
    },
  };
}

export default {
  VERSION,
  buildCustomerZeroPaperEnterExitGate,
};
