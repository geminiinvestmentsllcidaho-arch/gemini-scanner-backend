export const VERSION = "customer_stage1_completion_record_panel_v1";
const clean = (value) => String(value ?? "").trim();
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function buildCustomerStage1CompletionRecordPanel(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const proof = status.promotionProof ?? {};
  const complete = tracker.mechanicalSuccess === true && proof.mechanicalSuccess === true && clean(proof.evidenceId) && clean(proof.completedAt);
  return Object.freeze({
    version: VERSION,
    visible: Boolean(complete),
    state: complete ? "complete" : "pending",
    symbol: clean(tracker.symbol) || null,
    evidenceId: complete ? clean(proof.evidenceId) : null,
    baselineObservedAt: tracker.baselineObservedAt ?? null,
    enterDetectedAt: tracker.enterDetectedAt ?? null,
    exitDetectedAt: tracker.exitDetectedAt ?? null,
    completedAt: complete ? clean(proof.completedAt) : null,
    checks: Object.freeze({
      baselineObserved: tracker.baselineObserved === true,
      enterDetected: tracker.enterDetected === true,
      enterReconciled: tracker.enterReconciled === true,
      monitoringStarted: tracker.monitoringStarted === true,
      exitDetected: tracker.exitDetected === true,
      exitReconciled: tracker.exitReconciled === true,
      roundTripClosed: tracker.roundTripClosed === true,
      restartRecoveryVerified: tracker.restartRecoveryVerified === true,
      duplicateProtectionVerified: tracker.duplicateProtectionVerified === true,
      mechanicalSuccess: Boolean(complete),
    }),
    safety: Object.freeze({ readOnly: true, orderPlacementAllowed: false, accountMutationAllowed: false, stage2Locked: true, stage3Locked: true, promotionAutomatic: false }),
  });
}

export function renderCustomerStage1CompletionRecordPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  const row = (label, value) => `<li class="${value ? "pass" : "hold"}"><strong>${value ? "PASS" : "HOLD"}</strong> ${esc(label)}</li>`;
  return `<section class="card panel stage1-completion-record" data-stage1-completion-record>
<p class="stage1-kicker">Stage 1 • Completion record</p>
<h2>Manual paper round trip mechanically proven</h2>
<p><strong>Symbol:</strong> ${esc(panel.symbol ?? "Unavailable")}</p>
<p><strong>Evidence ID:</strong> <code>${esc(panel.evidenceId)}</code></p>
<div class="stage1-completion-times"><p><span>Baseline observed</span><strong>${esc(panel.baselineObservedAt ?? "Unavailable")}</strong></p><p><span>Entry detected</span><strong>${esc(panel.enterDetectedAt ?? "Unavailable")}</strong></p><p><span>Exit detected</span><strong>${esc(panel.exitDetectedAt ?? "Unavailable")}</strong></p><p><span>Completed</span><strong>${esc(panel.completedAt)}</strong></p></div>
<ul class="stage1-checks">${row("Zero-position baseline recorded", panel.checks?.baselineObserved)}${row("Manual one-share entry detected", panel.checks?.enterDetected)}${row("Entry reconciled", panel.checks?.enterReconciled)}${row("Position monitoring started", panel.checks?.monitoringStarted)}${row("Manual exit detected", panel.checks?.exitDetected)}${row("Exit reconciled", panel.checks?.exitReconciled)}${row("Round trip closed", panel.checks?.roundTripClosed)}${row("Restart recovery verified", panel.checks?.restartRecoveryVerified)}${row("Duplicate protection verified", panel.checks?.duplicateProtectionVerified)}${row("Mechanical proof complete", panel.checks?.mechanicalSuccess)}</ul>
<p class="notice"><strong>Stage 1 proof is complete.</strong> This record keeps Stage 2 locked. A separate explicit operator authorization and verification are required.</p>
<p class="helper">Read-only completion record. No broker contact, order placement, account mutation, execution enablement, or system-driven stage advancement.</p>
</section>`;
}

export default { VERSION, buildCustomerStage1CompletionRecordPanel, renderCustomerStage1CompletionRecordPanelHtml };
