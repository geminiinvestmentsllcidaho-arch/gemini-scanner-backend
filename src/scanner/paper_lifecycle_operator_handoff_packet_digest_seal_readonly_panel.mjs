import { createHash } from "node:crypto";
import { buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel } from "./paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel_v1";

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
  ["/app/paper-broker-network-attempt-status", "Paper Broker Network Attempt Status"],
  ["/app/paper-trade-readiness-report", "Paper Trade Readiness Report"],
  ["/app/paper-trade-broker-integration-preflight-stack", "Paper Trade Broker Integration Preflight Stack"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-trade-broker-adapter-guard", "Paper Trade Broker Adapter Guard"],
  ["/app/paper-trade-execution-control-stack", "Paper Trade Execution Control Stack"],
  ["/app/paper-trade-operator-go-no-go", "Paper Trade Operator Go / No-Go"],
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
  ["/app/paper-lifecycle-operator-handoff-packet-digest", "Paper Lifecycle Operator Handoff Packet Digest Read-Only"]
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

export function buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({
  runsDir = "runs",
  now = new Date(),
  markPrice = null
} = {}) {
  const digestReport = buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({ runsDir, now, markPrice });
  const digest = digestReport.operatorHandoffPacketDigest ?? {};

  const sealPayload = {
    sourceVersion: digestReport.version,
    sourceDisplayState: digestReport.displayState,
    sourceDigestStatus: digest.digestStatus ?? null,
    sourceDigestAlgorithm: digest.digestAlgorithm ?? null,
    sourceDigest: digest.digest ?? null,
    finalStatus: digest.finalStatus ?? null,
    symbol: digest.symbol ?? null,
    markPrice: digest.markPrice ?? null,
    nextAllowedAction: digest.nextAllowedAction ?? null,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    retryAllowed: false,
    accountMutationAllowed: false,
    safetyLocked: digest.safetyLocked === true,
    packetSectionCount: digest.packetSectionCount ?? null,
    packetItemCount: digest.packetItemCount ?? null,
    noRetryGuardReason: digest.noRetryGuardReason ?? null
  };

  const sealReady =
    digestReport.displayState === "OPERATOR_HANDOFF_PACKET_DIGEST_READY_READONLY" &&
    digest.digestReady === true &&
    digest.digestAlgorithm === "sha256" &&
    /^[a-f0-9]{64}$/.test(digest.digest ?? "") &&
    digest.retryAllowed === false &&
    digest.orderPlacementAllowed === false &&
    digest.brokerContactAllowed === false &&
    digest.accountMutationAllowed === false &&
    digest.safetyLocked === true &&
    digestReport.orderSubmitAttempted === false &&
    digestReport.orderSubmitted === false &&
    digestReport.brokerContactAttempted === false &&
    digestReport.accountMutationAttempted === false;

  const displayState = sealReady
    ? "OPERATOR_HANDOFF_PACKET_DIGEST_SEAL_READY_READONLY"
    : "OPERATOR_HANDOFF_PACKET_DIGEST_SEAL_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only",
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
    operatorHandoffPacketDigestSeal: {
      sealReady,
      sealStatus: sealReady
        ? "paper_lifecycle_operator_handoff_packet_digest_seal_ready_readonly"
        : "paper_lifecycle_operator_handoff_packet_digest_seal_incomplete_readonly",
      sealAt: now.toISOString(),
      sealAlgorithm: "sha256",
      sealHash: sha256(sealPayload),
      sealInputVersion: "operator_handoff_packet_digest_seal_input_v1",
      sourceDigestStatus: digest.digestStatus ?? null,
      sourceDigestDisplayState: digestReport.displayState,
      sourceDigestAlgorithm: digest.digestAlgorithm ?? null,
      sourceDigest: digest.digest ?? null,
      finalStatus: digest.finalStatus ?? null,
      symbol: digest.symbol ?? null,
      markPrice: digest.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: digest.safetyLocked === true,
      packetSectionCount: digest.packetSectionCount ?? null,
      packetItemCount: digest.packetItemCount ?? null,
      noRetryGuardReason: digest.noRetryGuardReason ?? null,
      sealPayload
    },
    operatorHandoffPacketDigest: digest,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: digestReport.noRetryGuard
  };
}

export function renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const seal = report.operatorHandoffPacketDigestSeal ?? {};
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only</h1>
<p>Read-only seal for the operator handoff packet digest. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Seal status: ${safe(seal.sealStatus)}</li>
<li>Seal algorithm: ${safe(seal.sealAlgorithm)}</li>
<li>Seal hash: ${safe(seal.sealHash)}</li>
<li>Source digest: ${safe(seal.sourceDigest)}</li>
<li>Next allowed action: ${safe(seal.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(seal.orderPlacementAllowed)}</li>
<li>Safety locked: ${safe(seal.safetyLocked)}</li>
<li>Digest route: /diagnostics/paper-lifecycle-operator-handoff-packet-digest-readonly</li>
</ul>
</body></html>`;
}
