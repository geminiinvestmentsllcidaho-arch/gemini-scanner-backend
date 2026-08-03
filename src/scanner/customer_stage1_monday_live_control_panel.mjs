const esc = (v) => String(v ?? "—").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

export function buildCustomerStage1MondayLiveControlPanel(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const snapshot = options.snapshot ?? {};
  const positions = Array.isArray(snapshot.positions) ? snapshot.positions : null;
  const orders = Array.isArray(snapshot.openOrders)
    ? snapshot.openOrders
    : Array.isArray(snapshot.orders)
      ? snapshot.orders
      : null;
  const observedAt = String(status.observedAt ?? "");
  const ageMs = observedAt ? Math.max(0, Number(options.nowMs ?? Date.now()) - Date.parse(observedAt)) : null;
  const checks = {
    marketOpen: options.marketOpen === true,
    runtimeReady: options.health?.degraded !== true && options.readiness?.ready === true,
    watcherFresh: Number.isFinite(ageMs) && ageMs <= 120000,
    paperConnected: snapshot.status === "connected_readonly"
      || snapshot.connected === true
      || snapshot.connectionStatus === "connected_readonly",
    accountKnown: positions !== null && orders !== null,
    baselineArmed: tracker.baselineObserved === true,
    stage2Locked: status.safety?.stage2Locked !== false,
    stage3Locked: status.safety?.stage3Locked !== false,
  };
  const entry = tracker.enterDetected === true;
  const exit = tracker.exitDetected === true;
  const complete = tracker.mechanicalSuccess === true;
  const ready = Object.values(checks).every(Boolean) && positions.length === 0 && orders.length === 0 && !entry;
  let state = "hold";
  let headline = "STOP — do not place the manual paper order yet.";
  let nextAction = "Resolve every failed prerequisite before taking action in Alpaca.";
  if (complete) {
    state = "complete";
    headline = "Stage 1 mechanical proof is complete.";
    nextAction = "Preserve and review the evidence. Promotion remains a separate decision.";
  } else if (entry && !exit) {
    state = "monitoring_exit";
    headline = "Manual entry detected — do not enter another position.";
    nextAction = "Monitor the single paper position, wait for the EXIT alert, then manually exit that same share.";
  } else if (entry && exit) {
    state = "reconciling";
    headline = "Manual exit detected — final reconciliation is pending.";
    nextAction = "Do not place another order. Wait for zero positions, zero open orders, and completion evidence.";
  } else if (ready) {
    state = "ready";
    headline = "READY — manually enter exactly one paper share.";
    nextAction = "In Alpaca paper trading, manually buy exactly one long share. Do not place a second order.";
  }
  return Object.freeze({
    visible: checks.baselineArmed,
    state,
    headline,
    nextAction,
    checks: Object.freeze([
      ["Market open", checks.marketOpen],
      ["Runtime healthy and ready", checks.runtimeReady],
      ["Manual watcher fresh", checks.watcherFresh],
      ["Paper account connected read-only", checks.paperConnected],
      ["Positions and open orders known", checks.accountKnown],
      ["Protected baseline armed", checks.baselineArmed],
      ["Stage 2 locked", checks.stage2Locked],
      ["Stage 3 locked", checks.stage3Locked],
    ]),
    positions: positions?.length ?? null,
    openOrders: orders?.length ?? null,
    safety: Object.freeze({ readOnly:true, paperOnly:true, brokerContactAllowed:false, orderPlacementAllowed:false, accountMutationAllowed:false }),
  });
}

export function renderCustomerStage1MondayLiveControlPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  const rows = (panel.checks ?? []).map(([label, pass]) => `<li class="${pass ? "pass" : "stop"}"><span>${esc(label)}</span><strong>${pass ? "PASS" : "STOP"}</strong></li>`).join("");
  return `<section class="card panel stage1-live-control stage1-live-${esc(panel.state)}" data-stage1-live-control data-stage1-live-state="${esc(panel.state)}">
<p class="stage1-kicker">Stage 1 • Monday live-test control</p>
<h2>${esc(panel.headline)}</h2>
<p><strong>Next action:</strong> ${esc(panel.nextAction)}</p>
<div class="stage1-grid"><p><span>Positions</span><strong>${esc(panel.positions)}</strong></p><p><span>Open orders</span><strong>${esc(panel.openOrders)}</strong></p></div>
<ul class="stage1-checks">${rows}</ul>
<p class="helper">Read-only and paper-only. GeminiScanner cannot contact the broker, place orders, mutate the account, or unlock later stages.</p>
</section>`;
}
