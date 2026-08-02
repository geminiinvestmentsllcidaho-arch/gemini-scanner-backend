export const VERSION = "customer_stage1_monday_checklist_panel_v1";

const clean = (value) => String(value ?? "").trim();
const finite = (value) => {
  if (value === null || value === undefined || clean(value) === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const esc = (value) => String(value ?? "Unavailable")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const freeze = (value) => Object.freeze(value);

export function buildCustomerStage1MondayChecklistPanel(options = {}) {
  const status = options.status ?? {};
  const operator = status.operator ?? {};
  const tracker = status.tracker ?? {};
  const snapshot = options.snapshot ?? {};
  const health = options.health ?? {};
  const readiness = options.readiness ?? {};
  const process = options.watcherProcess ?? {};
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const observedAt = clean(status.observedAt) || null;
  const observedAtMs = observedAt ? Date.parse(observedAt) : NaN;
  const watcherAgeMs = Number.isFinite(observedAtMs) && nowMs >= observedAtMs ? nowMs - observedAtMs : null;
  const watcherFresh = watcherAgeMs !== null && watcherAgeMs <= 45000;
  const snapshotObservedAt = clean(snapshot.observedAt) || null;
  const snapshotObservedAtMs = snapshotObservedAt ? Date.parse(snapshotObservedAt) : NaN;
  const snapshotAgeMs = Number.isFinite(snapshotObservedAtMs) && nowMs >= snapshotObservedAtMs ? nowMs - snapshotObservedAtMs : null;
  const snapshotFresh = snapshotAgeMs !== null && snapshotAgeMs <= 120000;
  const marketOpen = options.marketOpen === true;
  const connectedReadonly = snapshot.status === "connected_readonly";
  const positionsKnown = Array.isArray(snapshot.positions);
  const positions = positionsKnown ? snapshot.positions : [];
  const openOrdersKnown = Array.isArray(snapshot.openOrders);
  const openOrders = openOrdersKnown ? snapshot.openOrders : [];
  const watcherOnline = process.status === "online" || options.watcherOnline === true;
  const scannerHealthy = health.status === "ok" || health.healthy === true || health.degraded === false;
  const scannerReady = readiness.ready === true;
  const stage2Locked = status.safety?.stage2Locked === true || operator.safety?.stage2Locked === true;
  const stage3Locked = status.safety?.stage3Locked === true || operator.safety?.stage3Locked === true;
  const expectedSymbol = clean(tracker.symbol).toUpperCase() || null;
  const hardStops = [];

  if (!marketOpen) hardStops.push("market_not_open");
  if (!connectedReadonly) hardStops.push("paper_account_not_connected_readonly");
  if (!snapshotFresh) hardStops.push("paper_account_snapshot_stale_or_missing");
  if (!positionsKnown) hardStops.push("positions_unknown");
  if (!openOrdersKnown) hardStops.push("open_orders_unknown");
  if (!watcherOnline) hardStops.push("watcher_offline");
  if (!watcherFresh) hardStops.push("watcher_observation_stale_or_missing");
  if (!scannerHealthy) hardStops.push("scanner_health_not_healthy");
  if (!scannerReady) hardStops.push("scanner_not_ready");
  if (!stage2Locked) hardStops.push("stage2_lock_unexpectedly_open");
  if (!stage3Locked) hardStops.push("stage3_lock_unexpectedly_open");

  const beforeEntry = tracker.enterDetected !== true;
  if (beforeEntry && positionsKnown && positions.length > 0) hardStops.push("existing_position_before_test");
  if (beforeEntry && openOrdersKnown && openOrders.length > 0) hardStops.push("existing_open_order_before_test");
  if (positionsKnown && positions.length > 1) hardStops.push("multiple_positions");
  if (positionsKnown && positions.length === 1) {
    const position = positions[0] ?? {};
    const qty = finite(position.qty);
    const side = clean(position.side).toLowerCase();
    const symbol = clean(position.symbol).toUpperCase();
    if (qty !== 1) hardStops.push("quantity_not_exactly_one");
    if (side !== "long") hardStops.push("side_not_long");
    if (expectedSymbol && symbol !== expectedSymbol) hardStops.push("unexpected_symbol_mismatch_after_entry");
  }

  const baselineCaptured = tracker.baselineObserved === true;
  const exactNextOperatorAction = clean(operator.nextOperatorAction) ||
    (marketOpen ? "MANUALLY_BUY_EXACTLY_ONE_LONG_SHARE_IN_ALPACA_PAPER_UI" : "WAIT_FOR_REGULAR_MARKET_OPEN");
  const blocked = hardStops.length > 0;
  const readyForManualEntry = !blocked &&
    baselineCaptured &&
    positionsKnown &&
    positions.length === 0 &&
    openOrdersKnown &&
    openOrders.length === 0 &&
    operator.operatorState === "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY";

  return freeze({
    version: VERSION,
    visible: true,
    readOnly: true,
    noExecutionControls: true,
    state: readyForManualEntry ? "READY_FOR_MANUAL_ENTRY" : blocked ? "HARD_STOP" : "HOLD",
    marketOpen,
    connectedReadonly,
    snapshotFresh,
    snapshotObservedAt,
    snapshotAgeMs,
    baselineCaptured,
    positionsKnown,
    positionsCount: positionsKnown ? positions.length : null,
    openOrdersKnown,
    openOrdersCount: openOrdersKnown ? openOrders.length : null,
    watcherOnline,
    watcherFresh,
    watcherObservedAt: observedAt,
    watcherAgeMs,
    scannerHealthy,
    scannerReady,
    stage2Locked,
    stage3Locked,
    exactNextOperatorAction,
    expectedSymbol,
    hardStops: freeze(hardStops),
    safety: freeze({
      paperOnly: true,
      decisionAssistOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      automaticCorrectionAllowed: false,
      stage2Locked,
      stage3Locked,
    }),
  });
}

export function renderCustomerStage1MondayChecklistPanelHtml(panel = {}) {
  const row = (label, value) =>
    `<li class="${value === true ? "pass" : value === false ? "stop" : "hold"}"><strong>${value === true ? "PASS" : value === false ? "STOP" : "UNKNOWN"}</strong> ${esc(label)}</li>`;
  const stops = Array.isArray(panel.hardStops) ? panel.hardStops : [];
  return `<section class="card panel stage1-monday-checklist ${panel.state === "HARD_STOP" ? "stage1-operator-stop" : ""}" data-stage1-monday-checklist data-stage1-checklist-state="${esc(panel.state)}">
<p class="stage1-kicker">Stage 1 • Monday operator checklist</p>
<h2>${panel.state === "READY_FOR_MANUAL_ENTRY" ? "Ready for the manual one-share paper entry" : panel.state === "HARD_STOP" ? "HARD STOP — DO not place the paper order" : "Monday preparation hold"}</h2>
<p><strong>Exact next operator action:</strong> ${esc(panel.exactNextOperatorAction)}</p>
<ul class="stage1-checks">
${row("Regular market is open", panel.marketOpen)}
${row("Paper account is connected read-only", panel.connectedReadonly)}
${row("Paper snapshot is fresh", panel.snapshotFresh)}
${row("Zero-position baseline is captured", panel.baselineCaptured)}
${row("Positions are known", panel.positionsKnown)}
${row("Open orders are known", panel.openOrdersKnown)}
${row("Watcher process is online", panel.watcherOnline)}
${row("Watcher observation is fresh", panel.watcherFresh)}
${row("Scanner health is healthy", panel.scannerHealthy)}
${row("Scanner readiness is ready", panel.scannerReady)}
${row("Stage 2 remains locked", panel.stage2Locked)}
${row("Stage 3 remains locked", panel.stage3Locked)}
</ul>
<div class="stage1-grid">
<p><span>Snapshot age</span><strong>${esc(panel.snapshotAgeMs === null ? "Unavailable" : `${panel.snapshotAgeMs} ms`)}</strong></p>
<p><span>Watcher age</span><strong>${esc(panel.watcherAgeMs === null ? "Unavailable" : `${panel.watcherAgeMs} ms`)}</strong></p>
<p><span>Positions</span><strong>${esc(panel.positionsCount)}</strong></p>
<p><span>Open orders</span><strong>${esc(panel.openOrdersCount)}</strong></p>
<p><span>Expected symbol</span><strong>${esc(panel.expectedSymbol ?? "Captured after entry")}</strong></p>
<p><span>Execution controls</span><strong>None</strong></p>
</div>
${stops.length ? `<div class="stage1-anomaly-banner" role="alert"><strong>Hard-stop conditions:</strong><ul>${stops.map((stop) => `<li>${esc(stop)}</li>`).join("")}</ul></div>` : ""}
<p class="helper">Read-only observability only. No order submission, cancellation, replacement, broker mutation, automated correction, evidence reset, or stage unlock.</p>
</section>`;
}

export default {
  VERSION,
  buildCustomerStage1MondayChecklistPanel,
  renderCustomerStage1MondayChecklistPanelHtml,
};
