import { createHash } from "node:crypto";
import { buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel } from "./paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs";

export const VERSION = "paper_trading_completion_certificate_readonly_panel_v1";

function escRelatedBrokerReadinessHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const RELATED_BROKER_READINESS_ROUTES = Object.freeze([
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-lifecycle-dashboard", "Paper Lifecycle Read-Only Dashboard"],
  ["/app/paper-lifecycle-operator-summary", "Paper Lifecycle Operator Summary Read-Only"],
  ["/app/paper-lifecycle-final-status", "Paper Lifecycle Final Status Read-Only"],
  ["/app/paper-lifecycle-route-registry", "Paper Lifecycle Route Registry Read-Only"],
  ["/app/paper-lifecycle-evidence-index", "Paper Lifecycle Evidence Index Read-Only"],
  ["/app/paper-lifecycle-evidence-bundle", "Paper Lifecycle Evidence Bundle Read-Only"],
  ["/app/paper-lifecycle-completion-seal", "Paper Lifecycle Completion Seal Read-Only"],
  ["/app/paper-lifecycle-operator-review-checklist", "Paper Lifecycle Operator Review Checklist Read-Only"],
  ["/app/paper-lifecycle-operator-review-packet", "Paper Lifecycle Operator Review Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff", "Paper Lifecycle Operator Handoff Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet", "Paper Lifecycle Operator Handoff Packet Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest", "Paper Lifecycle Operator Handoff Packet Digest Read-Only"],
  ["/app/paper-lifecycle-operator-handoff-packet-digest-seal", "Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only"]
]);

function renderRelatedBrokerReadinessRoutes() {
  return RELATED_BROKER_READINESS_ROUTES
    .map(([href, label]) => `<li><a href="${escRelatedBrokerReadinessHtml(href)}">${escRelatedBrokerReadinessHtml(label)}</a></li>`)
    .join("");
}


function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stable(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

export function buildPaperTradingCompletionCertificateReadOnlyPanel({
  runsDir = "runs",
  now = new Date(),
  markPrice = null
} = {}) {
  const sealReport = buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({ runsDir, now, markPrice });
  const seal = sealReport.operatorHandoffPacketDigestSeal ?? {};
  const hex64 = /^[a-f0-9]{64}$/;

  const checks = {
    digestSealReady: sealReport.displayState === "OPERATOR_HANDOFF_PACKET_DIGEST_SEAL_READY_READONLY",
    sealReady: seal.sealReady === true,
    sealHashValid: hex64.test(seal.sealHash ?? ""),
    sourceDigestValid: hex64.test(seal.sourceDigest ?? ""),
    reviewOnlyAction: seal.nextAllowedAction === "review_handoff_only_no_order_placement",
    orderPlacementBlocked: seal.orderPlacementAllowed === false,
    brokerContactBlocked: seal.brokerContactAllowed === false,
    retryBlocked: seal.retryAllowed === false,
    accountMutationBlocked: seal.accountMutationAllowed === false,
    safetyLocked: seal.safetyLocked === true,
    noOrderSubmitAttempted: sealReport.orderSubmitAttempted === false && sealReport.orderSubmitted === false,
    noBrokerContactAttempted: sealReport.brokerContactAttempted === false,
    noAccountMutationAttempted: sealReport.accountMutationAttempted === false
  };

  const certificateReady = Object.values(checks).every(Boolean);
  const certificatePayload = {
    version: VERSION,
    sourceVersion: sealReport.version,
    sourceDisplayState: sealReport.displayState,
    sourceSealStatus: seal.sealStatus ?? null,
    sourceSealHash: seal.sealHash ?? null,
    sourceDigest: seal.sourceDigest ?? null,
    symbol: seal.symbol ?? null,
    markPrice: seal.markPrice ?? null,
    nextAllowedAction: "operator_review_only_no_order_placement",
    checks
  };

  const displayState = certificateReady
    ? "PAPER_TRADING_COMPLETION_CERTIFICATE_READY_READONLY"
    : "PAPER_TRADING_COMPLETION_CERTIFICATE_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Trading Completion Certificate Read-Only",
    displayState,
    status: displayState.toLowerCase(),
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    accountMutationAttempted: false,
    paperTradingCompletionCertificate: {
      certificateReady,
      certificateStatus: certificateReady
        ? "paper_trading_completion_certificate_ready_readonly"
        : "paper_trading_completion_certificate_incomplete_readonly",
      certificateAt: now.toISOString(),
      certificateAlgorithm: "sha256",
      certificateHash: sha256(certificatePayload),
      moduleState: certificateReady ? "paper_trading_readonly_module_complete" : "paper_trading_readonly_module_incomplete",
      completionScope: [
        "paper_order_intent",
        "paper_broker_adapter_lock",
        "paper_operator_review",
        "paper_final_status",
        "paper_evidence_bundle",
        "paper_completion_seal",
        "paper_operator_handoff",
        "paper_operator_handoff_packet",
        "paper_operator_handoff_packet_digest",
        "paper_operator_handoff_packet_digest_seal"
      ],
      nextAllowedAction: "operator_review_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: checks.safetyLocked,
      checks,
      sourceSealHash: seal.sealHash ?? null,
      sourceDigest: seal.sourceDigest ?? null,
      sourceSealStatus: seal.sealStatus ?? null,
      symbol: seal.symbol ?? null,
      markPrice: seal.markPrice ?? null,
      certificatePayload
    },
    operatorHandoffPacketDigestSeal: seal,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    }
  };
}

export function renderPaperTradingCompletionCertificateReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
  const cert = report.paperTradingCompletionCertificate ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Trading Completion Certificate Read-Only</h1>
<p>Read-only completion certificate for the paper trading module. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Certificate status: ${safe(cert.certificateStatus)}</li>
<li>Certificate algorithm: ${safe(cert.certificateAlgorithm)}</li>
<li>Certificate hash: ${safe(cert.certificateHash)}</li>
<li>Module state: ${safe(cert.moduleState)}</li>
<li>Next allowed action: ${safe(cert.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(cert.orderPlacementAllowed)}</li>
<li>Broker contact allowed: ${safe(cert.brokerContactAllowed)}</li>
<li>Safety locked: ${safe(cert.safetyLocked)}</li>
<li>Source seal hash: ${safe(cert.sourceSealHash)}</li>
</ul>
</body></html>`;
}
