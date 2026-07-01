import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPaperLifecycleOperatorHandoffReadOnlyPanel } from "./paper_lifecycle_operator_handoff_readonly_panel.mjs";

export const VERSION = "paper_lifecycle_operator_handoff_packet_readonly_panel_v1";

export function buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir = "runs", now = new Date(), markPrice = null } = {}) {
  const handoffReport = buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir, now, markPrice });
  const handoff = handoffReport.operatorHandoff ?? {};
  const seal = handoffReport.completionSeal ?? {};
  const final = handoffReport.final ?? {};
  const handoffItems = Array.isArray(handoff.handoffItems) ? handoff.handoffItems : [];

  const packetReady =
    handoffReport.displayState === "OPERATOR_HANDOFF_READY_READONLY" &&
    handoff.handoffReady === true &&
    handoff.safetyLocked === true &&
    handoff.nextAllowedAction === "review_handoff_only_no_order_placement" &&
    handoff.orderPlacementAllowed === false &&
    handoff.brokerContactAllowed === false &&
    handoff.retryAllowed === false &&
    handoff.accountMutationAllowed === false &&
    handoffReport.orderSubmitAttempted === false &&
    handoffReport.orderSubmitted === false &&
    handoffReport.brokerContactAttempted === false &&
    handoffReport.accountMutationAttempted === false &&
    handoffItems.length === 4 &&
    handoffItems.every((item) => item.ready === true && item.readOnly === true);

  const packetSections = [
    "operator_handoff",
    "completion_seal",
    "evidence_bundle",
    "final_status",
    "safety_flags",
    "no_retry_guard"
  ];

  const packetItems = [
    ...handoffItems.map((item) => ({
      key: item.key,
      label: item.label,
      route: item.route,
      panelRoute: item.panelRoute,
      ready: item.ready === true,
      readOnly: item.readOnly === true
    })),
    {
      key: "next_allowed_action",
      label: "Next allowed action",
      route: null,
      panelRoute: null,
      ready: handoff.nextAllowedAction === "review_handoff_only_no_order_placement",
      readOnly: true,
      value: "review_handoff_only_no_order_placement"
    },
    {
      key: "no_retry_guard",
      label: "No retry guard",
      route: null,
      panelRoute: null,
      ready: handoffReport.noRetryGuard?.active === true,
      readOnly: true,
      value: handoffReport.noRetryGuard?.reason ?? null
    }
  ];

  const displayState = packetReady ? "OPERATOR_HANDOFF_PACKET_READY_READONLY" : "OPERATOR_HANDOFF_PACKET_INCOMPLETE_READONLY";

  return {
    ok: true,
    version: VERSION,
    ts: now.toISOString(),
    panelType: "operator_dashboard_card",
    title: "Paper Lifecycle Operator Handoff Packet Read-Only",
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
    operatorHandoffPacket: {
      packetReady,
      packetStatus: packetReady ? "paper_lifecycle_operator_handoff_packet_ready_readonly" : "paper_lifecycle_operator_handoff_packet_incomplete_readonly",
      packetAt: now.toISOString(),
      sourceHandoffStatus: handoff.handoffStatus ?? null,
      sourceHandoffDisplayState: handoffReport.displayState,
      sourceSealStatus: handoff.sourceSealStatus ?? seal.sealStatus ?? null,
      sourceBundleStatus: handoff.sourceBundleStatus ?? seal.sourceBundleStatus ?? null,
      finalStatus: handoff.finalStatus ?? seal.finalStatus ?? null,
      symbol: handoff.symbol ?? seal.symbol ?? null,
      markPrice: handoff.markPrice ?? seal.markPrice ?? null,
      operatorAction: "review_only_no_execution",
      nextAllowedAction: "review_handoff_only_no_order_placement",
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      retryAlllowed: false,
      accountMutationAllowed: false,
      safetyLocked: handoff.safetyLocked === true,
      packetSectionCount: packetSections.length,
      packetItemCount: packetItems.length,
      packetSections,
      packetItems
    },
    operatorHandoff: handoff,
    completionSeal: seal,
    evidenceBundle: handoffReport.evidenceBundle,
    final,
    safety: {
      readOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      orderSubmitAllowed: false,
      retryAlllowed: false,
      accountMutationAllowed: false
    },
    noRetryGuard: handoffReport.noRetryGuard
  };
}

export function renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel(report) {
  const safe = (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const packet = report.operatorHandoffPacket ?? {};
  const rows = (packet.packetItems ?? [])
    .map((item) => `<li>${safe(item.key)} | ${safe(item.route ?? "n/a")} | panel: ${safe(item.panelRoute ?? "n/a")} | ready: ${safe(item.ready)} | readOnly: ${safe(item.readOnly)}</li>`)
    .join("\n");
  const sections = (packet.packetSections ?? [])
    .map((item) => `<li>section: ${safe(item)}</li>`)
    .join("\n");

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe(report.title)}</title></head><body>
<h1>Paper Lifecycle Operator Handoff Packet Read-Only</h1>
<p>Read-only operator handoff packet. No broker read, no broker contact, no order submit, no retry, no account mutation.</p>
<ul>
<li>Display state: ${safe(report.displayState)}</li>
<li>Packet status: ${safe(packet.packetStatus)}</li>
<li>Source handoff status: ${safe(packet.sourceHandoffStatus)}</li>
<li>Final status: ${safe(packet.finalStatus)}</li>
<li>Symbol: ${safe(packet.symbol)}</li>
<li>Mark price: ${safe(packet.markPrice)}</li>
<li>Next allowed action: ${safe(packet.nextAllowedAction)}</li>
<li>Order placement allowed: ${safe(packet.orderPlacementAllowed)}</li>
<li>Safety locked: ${safe(packet.safetyLocked)}</li>
<li>Operator handoff route: /diagnostics/paper-lifecycle-operator-handoff-readonly</li>
<li>Completion seal route: /diagnostics/paper-lifecycle-completion-seal-readonly</li>
</ul>
<ul>
${sections}
</ul>
<ul>
${rows}
</ul>
</body></html>`;
}

export function writePaperLifecycleOperatorHandoffPacketReadOnlyPanel(report, runsDir = "runs") {
  mkdirSync(runsDir, { recursive: true });
  const file = join(runsDir, `paper_lifecycle_operator_handoff_packet_readonly_panel_${report.ts.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
