import { fetchAlpacaUnderFiveUniverseReadonly } from "./alpaca_under_five_universe_readonly.mjs";
import { applyOwnedPositionExitReviewPolicy } from "./customer_owned_position_exit_review_policy.mjs";
import { applyOwnedPositionScaleInReviewPolicy } from "./customer_owned_position_scale_in_review_policy.mjs";
import { applyOwnedPositionScaleOutReviewPolicy } from "./customer_owned_position_scale_out_review_policy.mjs";

export const VERSION = "customer_owned_position_monitor_source_v1";

const list = (value) => Array.isArray(value) ? value : [];
const symbolOf = (value) => String(value ?? "").trim().toUpperCase();
const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

function capitalProtectionEvidence(root = null) {
  const age = numberOrNull(root?.sourceAgeSec);
  const max = numberOrNull(root?.maxAgeSec);
  const connected = Boolean(root && typeof root === "object");
  const stale = !connected || root?.stale !== false || age === null || max === null || age > max;
  return Object.freeze({
    capitalProtectionConnected: connected,
    capitalProtectionFresh: !stale,
    capitalProtectionStale: stale,
    capitalProtectionSourceTs: root?.sourceTs ?? null,
    capitalProtectionSourceAgeSec: age,
    capitalProtectionMaxAgeSec: max,
    capitalInvalidationState: connected ? String(root?.invalidationState ?? "").trim() || null : null,
    capitalDrawdownBrakeState: connected ? String(root?.drawdownBrakeState ?? "").trim() || null : null,
    capitalExitRouteState: connected ? String(root?.exitRouteState ?? "").trim() || null : null,
    capitalRouteUrgency: connected ? String(root?.routeUrgency ?? "").trim() || null : null,
    capitalProtectionCommandState: connected ? String(root?.protectionCommandState ?? "").trim() || null : null,
    capitalProtectionPermission: connected ? String(root?.protectionPermission ?? "").trim() || null : null,
  });
}

function ownedPositions(paperAccount = {}) {
  const seen = new Set();
  const rows = [];
  for (const position of list(paperAccount?.positions)) {
    const symbol = symbolOf(position?.symbol);
    const qty = numberOrNull(position?.qty);
    if (!symbol || !(qty > 0) || seen.has(symbol)) continue;
    seen.add(symbol);
    rows.push({ ...position, symbol, qty });
  }
  return rows;
}

function fallbackCandidate(position = {}) {
  const price = numberOrNull(position?.currentPrice ?? position?.current_price);
  return Object.freeze({
    symbol: symbolOf(position?.symbol),
    price,
    currentPrice: price,
    resultState: "WATCH",
    decision: "WATCH",
    readonlyPotentialScore: null,
    sourceCoverage: "owned_position_fallback",
    sourceFlags: Object.freeze(["owned_position_market_candidate_missing"]),
    ownedPositionMonitorOnly: true,
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}

export async function fetchCustomerOwnedPositionMonitorSource({
  paperAccount = {},
  fetchSymbols = fetchAlpacaUnderFiveUniverseReadonly,
  nowMs = Date.now(),
  maxAssets = 50,
  capitalProtectionRoot = null,
} = {}) {
  const positions = ownedPositions(paperAccount);
  const capitalProtection = capitalProtectionEvidence(capitalProtectionRoot);
  const symbols = positions.map((position) => position.symbol);

  if (symbols.length === 0) {
    return Object.freeze({
      ok: true,
      version: VERSION,
      status: "no_owned_positions",
      symbols: Object.freeze([]),
      candidates: Object.freeze([]),
      missingSymbols: Object.freeze([]),
      sourceStatus: null,
      readOnly: true,
      paperOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
    });
  }

  const fetched = await fetchSymbols({
    symbols,
    minPrice: 0,
    maxPrice: Number.POSITIVE_INFINITY,
    minDailyVolume: 0,
    maxAssets: Math.max(symbols.length, Number(maxAssets) || 50),
    nowMs,
  });

  const fetchedCandidates = list(fetched?.candidates);
  const bySymbol = new Map(
    fetchedCandidates
      .map((candidate) => [symbolOf(candidate?.symbol), candidate])
      .filter(([symbol]) => Boolean(symbol)),
  );

  const candidates = [];
  const missingSymbols = [];
  for (const position of positions) {
    const candidate = bySymbol.get(position.symbol);
    if (candidate) {
      const exitReviewed = applyOwnedPositionExitReviewPolicy({
        ...candidate,
        symbol: position.symbol,
        paperAccountEquity: paperAccount?.account?.equity ?? null,
        paperBuyingPower: paperAccount?.account?.buyingPower ?? null,
        ...capitalProtection,
        sourceCoverage: "owned_position_symbol_fetch",
        ownedPositionMonitorOnly: true,
        readOnly: true,
        paperOnly: true,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false,
      }, position);
      const scaleOutReviewed = applyOwnedPositionScaleOutReviewPolicy(exitReviewed, position);
      const scaleInReviewed = applyOwnedPositionScaleInReviewPolicy(scaleOutReviewed, position);
      const normalizedOwnedAssessment = (
        String(scaleInReviewed?.resultState ?? scaleInReviewed?.decision ?? "").toUpperCase() !== "EXIT"
        && scaleInReviewed?.ownedExitReviewTriggered !== true
        && scaleInReviewed?.ownedScaleOutReviewTriggered !== true
        && scaleInReviewed?.ownedScaleInReviewTriggered !== true
      )
        ? {
            ...scaleInReviewed,
            resultState: "WATCH",
            decision: "WATCH",
            ownedPositionAssessment: "WATCH",
          }
        : scaleInReviewed;
      candidates.push(Object.freeze(normalizedOwnedAssessment));
    } else {
      missingSymbols.push(position.symbol);
      candidates.push(fallbackCandidate(position));
    }
  }

  return Object.freeze({
    ok: fetched?.ok !== false,
    version: VERSION,
    status: missingSymbols.length === 0
      ? "owned_positions_covered"
      : "owned_positions_partially_covered",
    symbols: Object.freeze(symbols),
    candidates: Object.freeze(candidates),
    missingSymbols: Object.freeze(missingSymbols),
    sourceStatus: fetched?.status ?? null,
    readOnly: true,
    paperOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  });
}
