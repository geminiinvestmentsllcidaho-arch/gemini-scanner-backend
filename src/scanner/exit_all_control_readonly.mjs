const VERSION = "exit_all_control_readonly_v1";

function asBool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function clampText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text.slice(0, 80) : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildExitAllControlReadonly(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now());
  const requestedAction = clampText(input.requestedAction, "none");
  const inventorySource = clampText(input.inventorySource, "not_connected");
  const futureAutoModeKnown = asBool(input.futureAutoModeKnown);

  const safety = Object.freeze({
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    orderSubmitAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    sellOrderPlacementAllowed: false,
    liquidationAllowed: false,
    retryAllowed: false,
    orderSubmitted: false,
    brokerContactAttempted: false,
    accountMutationAttempted: false,
    inventoryMutationAttempted: false,
  });

  const intendedFutureBehavior = Object.freeze([
    "Pause all new automatic buy decisions until manually re-enabled.",
    "Request liquidation of current inventory only after separate broker integration, account authorization, position verification, and explicit operator approval.",
    "Use a future execution policy that prioritizes controlled exit quality, but never guarantees a best possible price.",
    "Keep a permanent audit trail of the halt, inventory snapshot, exit plan, and resume decision.",
  ]);

  const requiredFutureGuards = Object.freeze([
    "separate_auto_trading_module",
    "authenticated_operator_session",
    "broker_position_inventory_reader",
    "broker_order_router",
    "market_hours_and_liquidity_check",
    "two_step_exit_confirmation",
    "max_slippage_policy",
    "post_exit_buy_lock",
    "manual_resume_gate",
    "audit_log_append_only",
  ]);

  return Object.freeze({
    ok: true,
    version: VERSION,
    title: "Exit All / Auto-Buy Pause",
    displayState: "EXIT_ALL_CONTROL_LOCKED_READONLY",
    status: "locked_future_control_preview",
    severity: "blocked",
    requestedAction,
    inventorySource,
    futureAutoModeKnown,
    exitAllRequested: false,
    autoBuyPauseRequested: false,
    resumeAutoBuyRequested: false,
    canPauseNewBuysNow: false,
    canLiquidateInventoryNow: false,
    canResumeAutoBuyingNow: false,
    intendedFutureBehavior,
    requiredFutureGuards,
    safety,
    ...safety,
    lastUpdated: now.toISOString(),
  });
}

export function renderExitAllControlReadonlyHtml(model = buildExitAllControlReadonly()) {
  const behavior = model.intendedFutureBehavior
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  const guards = model.requiredFutureGuards
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(model.title)}</title>
  <style>
    body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}
    .wrap{max-width:760px;margin:auto}
    .card,.lock{background:white;border-radius:18px;padding:14px;margin:10px 0;box-shadow:0 8px 22px #0001}
    .hero{background:#111;color:white}
    .pill{display:inline-block;border-radius:999px;padding:6px 10px;background:#eee;margin:3px;font-size:12px}
    .danger{background:#310;color:#fff}
    .muted{color:#666}
    code{background:#eee;border-radius:8px;padding:2px 6px}
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card hero">
      <h1>${escapeHtml(model.title)}</h1>
      <p>${escapeHtml(model.displayState)}</p>
      <p>Read-only preview. No broker contact. No liquidation. No buying or selling controls.</p>
    </section>

    <section class="card">
      <h2>Future purpose</h2>
      <p>This defines a future emergency halt: stop new automatic buys, prepare an inventory exit plan, then keep buying locked until manually resumed.</p>
      <ul>${behavior}</ul>
    </section>

    <section class="lock">
      <h2>Current lock state</h2>
      <p><span class="pill danger">Exit All locked</span><span class="pill">Resume locked</span><span class="pill">Auto-buy pause preview only</span></p>
      <p><code>canPauseNewBuysNow=${escapeHtml(model.canPauseNewBuysNow)}</code></p>
      <p><code>canLiquidateInventoryNow=${escapeHtml(model.canLiquidateInventoryNow)}</code></p>
      <p><code>canResumeAutoBuyingNow=${escapeHtml(model.canResumeAutoBuyingNow)}</code></p>
      <p><code>orderSubmitted=${escapeHtml(model.orderSubmitted)}</code></p>
      <p><code>brokerContactAttempted=${escapeHtml(model.brokerContactAttempted)}</code></p>
    </section>

    <section class="card">
      <h2>Future required guards</h2>
      <ul>${guards}</ul>
    </section>

    <section class="card muted">
      <h2>Safety</h2>
      <p>readOnly=${escapeHtml(model.readOnly)} | monitorOnly=${escapeHtml(model.monitorOnly)} | diagnosticsOnly=${escapeHtml(model.diagnosticsOnly)} | noExecutionControls=${escapeHtml(model.noExecutionControls)}</p>
      <p>orderPlacementAllowed=${escapeHtml(model.orderPlacementAllowed)} | brokerContactAllowed=${escapeHtml(model.brokerContactAllowed)} | liquidationAllowed=${escapeHtml(model.liquidationAllowed)} | autoTradingAllowed=${escapeHtml(model.autoTradingAllowed)}</p>
      <p>Last updated: ${escapeHtml(model.lastUpdated)}</p>
    </section>
  </main>
</body>
</html>`;
}

export default {
  buildExitAllControlReadonly,
  renderExitAllControlReadonlyHtml,
};
