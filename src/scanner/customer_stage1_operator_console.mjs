export const VERSION = "customer_stage1_operator_console_v1";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const esc = (value) => String(value ?? "—")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const freeze = (value) => Object.freeze(value);

export function buildCustomerStage1OperatorConsole(options = {}) {
  const status = options.status ?? {};
  const operator = status.operator ?? {};
  const tracker = status.tracker ?? {};
  const snapshot = options.snapshot ?? {};
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const observedAt = clean(status.observedAt) || null;
  const observedAtMs = observedAt ? Date.parse(observedAt) : NaN;
  const watcherAgeMs = Number.isFinite(observedAtMs) ? Math.max(0, nowMs - observedAtMs) : null;
  const watcherFresh = watcherAgeMs !== null && watcherAgeMs <= 45000;
  const marketOpen = options.marketOpen === true;
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : [];
  const openOrders = Array.isArray(snapshot.openOrders) ? snapshot.openOrders : [];
  const positionsKnown = Array.isArray(snapshot.positions);
  const openOrdersKnown = Array.isArray(snapshot.openOrders);
  const expectedSymbol = clean(tracker.symbol).toUpperCase() || null;
  const anomalies = [];

  if (!watcherFresh) anomalies.push("watcher_status_stale_or_missing");
  if (status.ok !== true) anomalies.push("readonly_watcher_unhealthy");
  if (!positionsKnown) anomalies.push("positions_snapshot_unavailable");
  if (!openOrdersKnown) anomalies.push("open_orders_snapshot_unavailable");
  if (openOrdersKnown && openOrders.length > 0) anomalies.push("unexpected_open_orders_present");
  if (positionsKnown && positions.length > 1) anomalies.push("more_than_one_position_present");

  if (positionsKnown && positions.length === 1) {
    const position = positions[0] ?? {};
    const qty = finite(position.qty);
    const side = clean(position.side).toLowerCase();
    const symbol = clean(position.symbol).toUpperCase();
    if (qty !== 1) anomalies.push("position_quantity_must_equal_one_share");
    if (side !== "long") anomalies.push("position_must_be_long");
    if (expectedSymbol && symbol !== expectedSymbol) anomalies.push("unexpected_position_symbol");
  }

  const baselineReady = tracker.baselineObserved === true && operator.positionsKnown === true && operator.positionsCount === 0 && operator.openOrdersKnown === true && operator.openOrdersCount === 0;
  const complete = tracker.mechanicalSuccess === true;
  const blocked = anomalies.length > 0;
  let state = "HOLD";
  let nextAction = "Restore fresh read-only evidence before continuing.";
  if (!marketOpen) {
    state = "MARKET_CLOSED";
    nextAction = "Wait for the regular market session before the manual paper entry.";
  } else if (blocked) {
    state = "STOP";
    nextAction = "Do not place another paper order. Resolve every anomaly first.";
  } else if (complete) {
    state = "COMPLETE";
    nextAction = "Keep Stage 2 locked until a separate explicit authorization.";
  } else if (tracker.enterDetected === true && tracker.exitDetected !== true) {
    state = "MONITORING";
    nextAction = "Monitor the one-share position and manually close only that share when the EXIT review is triggered.";
  } else if (baselineReady && operator.operatorState === "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY") {
    state = "READY";
    nextAction = "In Alpaca Paper, manually buy exactly one long share.";
  }

  return freeze({
    version: VERSION,
    visible: true,
    state,
    blocked,
    nextAction,
    marketOpen,
    watcherFresh,
    watcherAgeMs,
    observedAt,
    cycle: status.cycle ?? null,
    operatorState: operator.operatorState ?? null,
    expectedSymbol,
    positionsKnown,
    positionsCount: positionsKnown ? positions.length : null,
    openOrdersKnown,
    openOrdersCount: openOrdersKnown ? openOrders.length : null,
    baselineReady,
    enterDetected: tracker.enterDetected === true,
    enterReconciled: tracker.enterReconciled === true,
    monitoringStarted: tracker.monitoringStarted === true,
    exitDetected: tracker.exitDetected === true,
    exitReconciled: tracker.exitReconciled === true,
    restartRecoveryVerified: tracker.restartRecoveryVerified === true,
    duplicateProtectionVerified: tracker.duplicateProtectionVerified === true,
    mechanicalSuccess: complete,
    visualExitAlertReady: true,
    audioExitAlertRequiresUserGesture: true,
    anomalies: freeze(anomalies),
    safety: freeze({ readOnly: true, paperOnly: true, brokerContactAllowed: false, orderPlacementAllowed: false, accountMutationAllowed: false, stage2Locked: true, stage3Locked: true }),
  });
}

export function renderCustomerStage1OperatorConsoleHtml(consoleModel = {}) {
  const item = (label, value) => `<li class="${value ? "pass" : "hold"}"><strong>${value ? "PASS" : "HOLD"}</strong> ${esc(label)}</li>`;
  const anomalies = Array.isArray(consoleModel.anomalies) ? consoleModel.anomalies : [];
  return `<section class="card panel stage1-operator-console ${consoleModel.blocked ? "stage1-operator-stop" : ""}" data-stage1-operator-console data-stage1-operator-state="${esc(consoleModel.state)}">
<p class="stage1-kicker">Stage 1 • Monday operator console</p>
<h2>${consoleModel.blocked ? "STOP — Stage 1 anomaly detected" : "Manual paper test control center"}</h2>
<p><strong>State:</strong> ${esc(consoleModel.state)} · <strong>Next permitted action:</strong> ${esc(consoleModel.nextAction)}</p>
<ul class="stage1-checks">${item("Market is open", consoleModel.marketOpen)}${item("Watcher evidence is fresh", consoleModel.watcherFresh)}${item("Zero-position baseline is ready", consoleModel.baselineReady)}${item("Stage 2 remains locked", consoleModel.safety?.stage2Locked === true)}${item("Stage 3 remains locked", consoleModel.safety?.stage3Locked === true)}</ul>
<div class="stage1-grid"><p><span>Watcher age</span><strong>${esc(consoleModel.watcherAgeMs ?? "Unknown")} ms</strong></p><p><span>Watcher cycle</span><strong>${esc(consoleModel.cycle ?? "Unknown")}</strong></p><p><span>Positions</span><strong>${esc(consoleModel.positionsCount ?? "Unknown")}</strong></p><p><span>Open orders</span><strong>${esc(consoleModel.openOrdersCount ?? "Unknown")}</strong></p><p><span>Expected symbol</span><strong>${esc(consoleModel.expectedSymbol ?? "Waiting")}</strong></p><p><span>EXIT alert readiness</span><strong>Visual ready; audio after user gesture</strong></p></div>
${anomalies.length ? `<div class="stage1-anomaly-banner" role="alert"><strong>Hard stop conditions:</strong><ul>${anomalies.map((issue) => `<li>${esc(issue)}</li>`).join("")}</ul></div>` : ""}
<p class="helper">Read-only paper evidence only. No order submission, cancellation, replacement, broker mutation, evidence reset, or automatic stage promotion.</p>
</section>`;
}

export default { VERSION, buildCustomerStage1OperatorConsole, renderCustomerStage1OperatorConsoleHtml };
