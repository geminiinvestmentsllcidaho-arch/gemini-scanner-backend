import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel } from "./paper_lifecycle_operator_handoff_packet_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_handoff_packet_digest_readonly_panel_v1";

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
  ["/app/paper-lifecycle-operator-handoff-packet", "Paper Lifecycle Operator Handoff Packet Read-Only"]
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

export function buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const packetReport = buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir, now, markPrice });
  const packet = packetReport.operatorHandoffPacket ?? {};
  const items = Array.isArray(packet.packetItems) ? packet.packetItems : [];

  const digestPayload = {
    version: packetReport.version,
    sourceDisplayState: packetReport.displayState,
    sourcePacketStatus: packet.packetStatus ?? null,
    sourceHandoffStatus: packet.sourceHandoffStatus ?? null,
    sourceSealStatus: packet.sourceSealStatus ?? null,
    sourceBundleStatus: packet.sourceBundleStatus ?? null,
    finalStatus: packet.finalStatus ?? null,
    symbol: packet.symbol ?? null,
    markPrice: packet.markPrice ?? null,
    nextAllowedAction: packet.nextAllowedAction ?? null,
    orderPlacementAllowed: packet.orderPlacementAllowed,
    brokerContactAllowed: packet.brokerContactAllowed,
    retryAllowed: packet.retryAllowed,
    accountMutationAllowed: packet.accountMutationAllowed,
    safetyLocked: packet.safetyLocked,
    packetSectionCount: packet.packetSectionCount,
    packetItemCount: packet.packetItemCount,
    packetItems: items.map((item) => ({
      key: item.key,
      route: item.route ?? null,
      panelRoute: item.panelRoute ?? null,
      ready: item.ready === true,
      readOnly: item.readOnly === true,
      value: item.value ?? null
    })),
    noRetryGuardReason: packetReport.noRetryGuard?.reason ?? null
  };

  const digestReady =
    packetReport.displayState === "OPERATOR_HANDOFF_PACKET_READY_READONLY" &&
    packet.packetReady === true &&
    packet.retryAllowed === false &&
    packet.orderPlacementAllowed === false &&
    packet.brokerContactAllowed === false &&
    packet.accountMutationAllowed === false &&
    packet.safetyLocked === true &&
    packetReport.orderSubmitAttempted === false &&
    packetReport.orderSubmitted === false &&
    packetReport.brokerContactAttempted === false &&
    packetReport.accountMutationAttempted === false &&
    items.length === 6 &&
    items.every((item) => item.ready === true && item.readOnly === true);

  const digest = sha256(digestPayload);
  const displayState = digestReady ? "OPERATOR_HANDOFF_PACKET_DIGEST_READY_READONLY" : "OPERATOR_HANDOFF_PACKET_DIGEST_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Handoff Packet Digest Read-Only",
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
    operatorHandoffPacketDigest: {
      digestReady,
      digestStatus: digestReady ? "paper_lifecycle_operator_handoff_packet_digest_ready_readonly" : "paper_lifecycle_operator_handoff_packet_digest_incomplete_readonly",
      digestAt: now.toISOString(),
      digestAlgorithm: "sha256",
      digest,
      digestInputVersion: "operator_handoff_packet_digest_input_v1",
      sourcePacketStatus: packet.packetStatus ?? null,
      sourcePacketDisplayState: packetReport.displayState,
      sourceHandoffStatus: packet.sourceHandoffStatus ?? null,
      sourceSealStatus: packet.sourceSealStatus ?? null,
      sourceBundleStatus: packet.sourceBundleStatus ?? null,
      finalStatus: packet.finalStatus ?? null,
      symbol: packet.symbol ?? null,
      markPrice: packet.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false,
      safetyLocked: packet.safetyLocked === true,
      packetSectionCount: packet.packetSectionCount ?? null,
      packetItemCount: packet.packetItemCount ?? null,
      noRetryGuardReason: packetReport.noRetryGuard?.reason ?? null,
      digestPayload
    },
    operatorHandoffPacket: packet,
    operatorHandoff: packetReport.operatorHandoff,
    completionSeal: packetReport.completionSeal,
    evidenceBundle: packetReport.evidenceBundle,
    final: packetReport.final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: packetReport.noRetryGuard
  };
}

export function renderPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const digest = report.operatorHandoffPacketDigest ?? {};
  const items = (digest.digestPayload?.packetItems ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route ?? "n/a")} | ready: ${safe(item.ready)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Handoff Packet Digest Read-Only</h1>
<p>Read-only digest for the operator handoff packet. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<section><h2>Related Broker Readiness Routes</h2><ul>${renderRelatedBrokerReadinessRoutes()}</ul></section>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Digest status: ${safe(digest.digestStatus)}</li>
<li>Digest algorithm: ${safe(digest.digestAlgorithm)}</li>
<li>Digest: ${safe(digest.digest)}</li>
<li>Source packet status: ${safe(digest.sourcePacketStatus)}</li>
<li>Final status: ${safe(digest.finalStatus)}</li>
<li>Symbol: ${safe(digest.symbol)}</li>
<li>Mark price: ${safe(digest.markPrice)}</li>
<li>Next allowed action: ${safe(digest.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(digest.orderPlacementAllowed)}</li>
<li>Safety locked: ${safe(digest.safetyLocked)}</li>
<li>Operator handoff packet route: /diagnostics/paper-lifecycle-operator-handoff-packet-readonly</li>
</ul>
<ul>

${items}
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_handoff_packet_digest_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
