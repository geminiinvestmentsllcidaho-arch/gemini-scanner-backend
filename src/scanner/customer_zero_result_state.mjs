export const VERSION = "customer_zero_result_state_v1";

export const CUSTOMER_ZERO_RESULT_STATES = Object.freeze([
  "ENTER",
  "DO_NOT_ENTER",
  "WAIT",
  "EXIT",
  "BLOCKED",
  "WATCH",
  "NO_SETUP",
  "STALE_DATA",
]);

function text(value) {
  return String(value ?? "").trim().toUpperCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function includesAny(values, terms) {
  return values.some((value) => terms.some((term) => value.includes(term)));
}

export function normalizeCustomerZeroResultState(source = {}) {
  const values = [
    source.resultState,
    source.decision,
    source.appDecision,
    source.primaryCommand,
    source.appPrimaryCommand,
    source.stage2FinalCommand,
    source.scannerReadiness,
    source.scannerActionBias,
    source.executionReadiness,
    source.displayState,
    source.status,
    source.primarySetup,
  ].map(text).filter(Boolean);

  const reasons = Array.isArray(source.reasons) ? source.reasons.map(text) : [];
  const issues = Array.isArray(source.issues) ? source.issues.map(text) : [];
  const markers = [...values, ...reasons, ...issues];

  const stale =
    bool(source.stale) ||
    bool(source.freshness?.stale) ||
    bool(source.scannerFreshness?.stale) ||
    includesAny(markers, ["STALE_DATA", "DATA_STALE", "STALE"]);

  const exit =
    bool(source.exitRequired) ||
    bool(source.forcedExit) ||
    includesAny(markers, ["FORCED_EXIT", "EXIT_REQUIRED", "PROTECTION_EXIT_REQUIRED"]) ||
    values.includes("EXIT");

  const blocked =
    bool(source.blocked) ||
    bool(source.halted) ||
    source.p3GateOk === false ||
    includesAny(values, ["BLOCKED", "PROTECTION_LOCKED", "DENIED"]) ||
    includesAny(issues, ["BLOCKED", "LOCKED"]);

  const doNotEnter =
    values.includes("DO_NOT_ENTER") ||
    values.includes("DO_NOT_TRADE") ||
    values.includes("NO_TRADE");

  const wait = includesAny(values, ["WAIT", "WAIT_FOR_CONFIRMATION", "WAITING_FOR_APPROVAL"]);
  const watch = includesAny(values, ["WATCH", "WATCH_ONLY", "WATCH_CONTRACT"]);

  const explicitEnter =
    values.includes("ENTER") ||
    values.includes("BUY") ||
    values.includes("REVIEW_SETUP");

  let state = "NO_SETUP";
  if (stale) state = "STALE_DATA";
  else if (exit) state = "EXIT";
  else if (blocked) state = "BLOCKED";
  else if (doNotEnter) state = "DO_NOT_ENTER";
  else if (wait) state = "WAIT";
  else if (watch) state = "WATCH";
  else if (explicitEnter) state = "ENTER";

  return Object.freeze({
    version: VERSION,
    state,
    tradePermission: state === "ENTER" ? "review_allowed" : "denied",
    orderPlacementAllowed: false,
    paperOrderPlacementAllowed: false,
    liveOrderPlacementAllowed: false,
    sourceValues: Object.freeze(values),
  });
}

export default {
  VERSION,
  CUSTOMER_ZERO_RESULT_STATES,
  normalizeCustomerZeroResultState,
};
