export const VERSION = "customer_stage1_post_trade_review_panel_v1";

const clean = (v) => String(v ?? "").trim();
const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
const round = (v, places = 2) => {
  const n = finite(v);
  if (n === null) return null;
  const scale = 10 ** places;
  return Math.round((n + Number.EPSILON) * scale) / scale;
};
const delta = (after, before) => {
  const a = finite(after);
  const b = finite(before);
  return a === null || b === null ? null : round(a - b);
};
const elapsedMs = (end, start) => {
  const a = Date.parse(end ?? "");
  const b = Date.parse(start ?? "");
  return Number.isFinite(a) && Number.isFinite(b) && a >= b ? a - b : null;
};
const freeze = (v) => Object.freeze(v);

export function buildCustomerStage1PostTradeReviewPanel(options = {}) {
  const tracker = options.tracker ?? options.status?.tracker ?? {};
  const proof = options.proof ?? {};
  const baseline = tracker.baselineAccount ?? {};
  const entry = tracker.entryAccount ?? {};
  const exit = tracker.exitAccount ?? {};
  const evidenceId = clean(proof.evidenceId ?? tracker.evidenceId);
  const completedAt = clean(proof.completedAt ?? tracker.completedAt);
  const complete = tracker.mechanicalSuccess === true && proof.mechanicalSuccess === true && Boolean(evidenceId) && Boolean(completedAt);
  const qty = finite(tracker.enterQty);
  const averageEntryPrice = finite(tracker.averageEntryPrice);
  const estimatedExitPrice = qty && qty > 0 && finite(entry.cash) !== null && finite(exit.cash) !== null
    ? round(averageEntryPrice + ((finite(exit.cash) - finite(entry.cash)) / qty), 4)
    : null;
  const estimatedRealizedPnl = averageEntryPrice !== null && estimatedExitPrice !== null && qty !== null
    ? round((estimatedExitPrice - averageEntryPrice) * qty)
    : delta(exit.equity, baseline.equity);
  const issues = [];
  if (!complete) issues.push("stage1_mechanical_proof_incomplete");
  if (finite(baseline.cash) === null) issues.push("baseline_account_evidence_missing");
  if (finite(entry.cash) === null) issues.push("entry_account_evidence_missing");
  if (finite(exit.cash) === null) issues.push("exit_account_evidence_missing");

  return freeze({
    version: VERSION,
    visible: complete,
    verdict: complete && issues.length === 0 ? "PASS" : "PENDING",
    headline: complete ? "Stage 1 mechanical proof passed" : "Stage 1 post-trade review pending",
    evidenceId: evidenceId || null,
    completedAt: completedAt || null,
    trade: freeze({
      symbol: clean(tracker.symbol).toUpperCase() || null,
      quantity: qty,
      averageEntryPrice,
      estimatedExitPrice,
      estimatedRealizedPnl,
    }),
    timing: freeze({
      baselineObservedAt: tracker.baselineObservedAt ?? null,
      entryDetectedAt: tracker.enterDetectedAt ?? null,
      entrySnapshotObservedAt: tracker.enterSnapshotObservedAt ?? null,
      entryDetectionLatencyMs: finite(tracker.enterDetectionLatencyMs),
      exitDetectedAt: tracker.exitDetectedAt ?? null,
      exitSnapshotObservedAt: tracker.exitSnapshotObservedAt ?? null,
      exitDetectionLatencyMs: finite(tracker.exitDetectionLatencyMs),
      completedAt: completedAt || null,
      baselineToEntryMs: elapsedMs(tracker.enterDetectedAt, tracker.baselineObservedAt),
      entryToExitMs: elapsedMs(tracker.exitDetectedAt, tracker.enterDetectedAt),
      exitToCompletionMs: elapsedMs(completedAt, tracker.exitDetectedAt),
    }),
    reconciliation: freeze({
      entryVsBaseline: freeze({
        cash: delta(entry.cash, baseline.cash),
        buyingPower: delta(entry.buyingPower, baseline.buyingPower),
        equity: delta(entry.equity, baseline.equity),
        portfolioValue: delta(entry.portfolioValue, baseline.portfolioValue),
      }),
      exitVsBaseline: freeze({
        cash: delta(exit.cash, baseline.cash),
        buyingPower: delta(exit.buyingPower, baseline.buyingPower),
        equity: delta(exit.equity, baseline.equity),
        portfolioValue: delta(exit.portfolioValue, baseline.portfolioValue),
      }),
    }),
    checks: freeze({
      baselineObserved: tracker.baselineObserved === true,
      enterDetected: tracker.enterDetected === true,
      enterReconciled: tracker.enterReconciled === true,
      monitoringStarted: tracker.monitoringStarted === true,
      exitDetected: tracker.exitDetected === true,
      exitReconciled: tracker.exitReconciled === true,
      roundTripClosed: tracker.roundTripClosed === true,
      restartRecoveryVerified: tracker.restartRecoveryVerified === true,
      duplicateProtectionVerified: tracker.duplicateProtectionVerified === true,
      mechanicalSuccess: complete,
      visualExitAlertReady: true,
      audioExitAlertRequiresUserGesture: true,
    }),
    issues: freeze(issues),
    safety: freeze({
      readOnly: true,
      paperOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      executionEnabled: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

const esc = (v) => String(v ?? "—").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money = (v) => finite(v) === null ? "Unavailable" : `$${finite(v).toFixed(2)}`;
const row = (label, ok) => `<li>${ok ? "✓" : "Pending"} — ${esc(label)}</li>`;

export function renderCustomerStage1PostTradeReviewPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  const trade = panel.trade ?? {};
  const timing = panel.timing ?? {};
  const reconciliation = panel.reconciliation ?? {};
  const checks = panel.checks ?? {};
  return `<section class="card panel stage1-post-trade-review" data-stage1-post-trade-review>
<p class="stage1-kicker">Stage 1 • Post-trade mechanical review</p>
<h2>${esc(panel.headline)}</h2>
<p><strong>Verdict:</strong> ${esc(panel.verdict)} · <strong>Evidence:</strong> ${esc(panel.evidenceId)}</p>
<div class="stage1-review-grid">
<article><h3>Trade identity</h3><ul><li>Symbol: ${esc(trade.symbol)}</li><li>Quantity: ${esc(trade.quantity)}</li><li>Average entry: ${money(trade.averageEntryPrice)}</li><li>Estimated exit: ${money(trade.estimatedExitPrice)}</li><li>Estimated realized paper P/L: ${money(trade.estimatedRealizedPnl)}</li></ul></article>
<article><h3>Detection timing</h3><ul><li>Entry snapshot to detection: ${esc(timing.entryDetectionLatencyMs)} ms</li><li>Exit snapshot to detection: ${esc(timing.exitDetectionLatencyMs)} ms</li><li>Baseline to entry: ${esc(timing.baselineToEntryMs)} ms</li><li>Entry to exit: ${esc(timing.entryToExitMs)} ms</li><li>Exit to completion: ${esc(timing.exitToCompletionMs)} ms</li></ul></article>
<article><h3>Account reconciliation</h3><ul><li>Entry cash delta: ${money(reconciliation.entryVsBaseline?.cash)}</li><li>Exit cash delta: ${money(reconciliation.exitVsBaseline?.cash)}</li><li>Exit equity delta: ${money(reconciliation.exitVsBaseline?.equity)}</li><li>Exit portfolio-value delta: ${money(reconciliation.exitVsBaseline?.portfolioValue)}</li></ul></article>
<article><h3>Completion checks</h3><ul>${row("Baseline recorded", checks.baselineObserved)}${row("Entry detected and reconciled", checks.enterDetected && checks.enterReconciled)}${row("Position monitoring started", checks.monitoringStarted)}${row("Exit detected and reconciled", checks.exitDetected && checks.exitReconciled)}${row("Restart recovery verified", checks.restartRecoveryVerified)}${row("Duplicate protection verified", checks.duplicateProtectionVerified)}${row("Mechanical proof complete", checks.mechanicalSuccess)}</ul></article>
</div>
<p class="helper">Read-only paper-trade review. Estimated P/L is reconciliation-derived and is not brokerage tax-lot accounting. No broker contact, order placement, account mutation, execution enablement, or automatic stage advancement.</p>
</section>`;
}

export default { VERSION, buildCustomerStage1PostTradeReviewPanel, renderCustomerStage1PostTradeReviewPanelHtml };
