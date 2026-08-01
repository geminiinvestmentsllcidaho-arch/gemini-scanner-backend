export const VERSION = "customer_stage1_evidence_download_panel_v1";

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const result = (value) => value === true ? "PASS" : "PENDING";

export function buildCustomerStage1EvidenceDownloadPanel(options = {}) {
  const record = options.record ?? {};
  return Object.freeze({
    version: VERSION,
    verdict: record.verdict === "PASS" ? "PASS" : "PENDING",
    exportReady: record.exportReady === true,
    evidenceId: record.evidenceId ?? null,
    fingerprint: record.fingerprint ?? null,
    completedAt: record.completedAt ?? null,
    zeroPositions: record.checks?.zeroPositions === true,
    zeroOpenOrders: record.checks?.zeroOpenOrders === true,
    restartRecoveryVerified: record.checks?.restartRecoveryVerified === true,
    duplicateProtectionVerified: record.checks?.duplicateProtectionVerified === true,
    stage2Locked: record.checks?.stage2Locked === true,
    stage3Locked: record.checks?.stage3Locked === true,
    issues: Object.freeze(Array.isArray(record.issues) ? [...record.issues] : []),
    jsonHref: "/customer/stage1/evidence.json",
    textHref: "/customer/stage1/evidence.txt",
    readOnly: true,
  });
}

export function renderCustomerStage1EvidenceDownloadPanelHtml(panel = {}) {
  const links = panel.exportReady
    ? `<div class="stage1-evidence-actions"><a class="safe-button" href="${esc(panel.jsonHref)}">Download JSON evidence</a><a class="secondary-button" href="${esc(panel.textHref)}">Download text report</a></div>`
    : '<p class="stage1-evidence-pending"><strong>Downloads remain locked until every Stage 1 closeout requirement passes.</strong></p>';
  const issues = Array.isArray(panel.issues) && panel.issues.length
    ? `<details><summary>Technical pending reasons</summary><ul>${panel.issues.map((issue) => `<li><code>${esc(issue)}</code></li>`).join("")}</ul></details>`
    : "";
  return `<section class="card panel stage1-evidence-download" data-stage1-evidence-download>
<p class="stage1-kicker">Stage 1 evidence delivery</p>
<h2>${esc(panel.verdict)} closeout verdict</h2>
<div class="stage1-grid">
<p><span>Evidence ID</span><strong>${esc(panel.evidenceId ?? "Pending")}</strong></p>
<p><span>SHA-256 fingerprint</span><strong><code>${esc(panel.fingerprint ?? "Pending")}</code></strong></p>
<p><span>Completion timestamp</span><strong>${esc(panel.completedAt ?? "Pending")}</strong></p>
<p><span>Zero positions</span><strong>${result(panel.zeroPositions)}</strong></p>
<p><span>Zero open orders</span><strong>${result(panel.zeroOpenOrders)}</strong></p>
<p><span>Restart recovery</span><strong>${result(panel.restartRecoveryVerified)}</strong></p>
<p><span>Duplicate protection</span><strong>${result(panel.duplicateProtectionVerified)}</strong></p>
<p><span>Stage 2 lock</span><strong>${result(panel.stage2Locked)}</strong></p>
<p><span>Stage 3 lock</span><strong>${result(panel.stage3Locked)}</strong></p>
</div>
${links}${issues}
<p>Authenticated, read-only paper evidence. Download availability does not unlock Stage 2 or Stage 3 and cannot place orders, contact a broker, mutate an account, or reset evidence.</p>
</section>`;
}

export default { VERSION, buildCustomerStage1EvidenceDownloadPanel, renderCustomerStage1EvidenceDownloadPanelHtml };
