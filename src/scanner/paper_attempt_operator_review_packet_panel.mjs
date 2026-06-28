import { buildPacket, VERSION as REVIEW_PACKET_VERSION } from "./paper_attempt_operator_review_packet.mjs";

export const PAPER_ATTEMPT_OPERATOR_REVIEW_PACKET_PANEL_VERSION = "paper_attempt_operator_review_packet_panel_v1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badge(label, value, tone = "neutral") {
  return { label, value, tone };
}

export function buildPaperAttemptOperatorReviewPacketPanel(options = {}) {
  const packet = buildPacket(options);
  const blockers = asArray(packet.blockers);
  const warnings = asArray(packet.warnings);
  const artifacts = packet.artifacts && typeof packet.artifacts === "object" ? packet.artifacts : {};
  const reviewDecision = packet.reviewDecision && typeof packet.reviewDecision === "object" ? packet.reviewDecision : {};

  const panel = {
    ok: true,
    version: PAPER_ATTEMPT_OPERATOR_REVIEW_PACKET_PANEL_VERSION,
    sourceVersion: REVIEW_PACKET_VERSION,
    panelType: "operator_dashboard_card",
    generatedAt: new Date(options.now ?? Date.now()).toISOString(),
    title: "Paper Attempt Operator Review Packet",
    subtitle: "Review-only packet. No broker contact. No order placement.",
    status: blockers.length === 0 ? "review_ready_no_go" : "review_blocked_no_go",
    severity: blockers.length === 0 ? "review_only" : "blocked",
    reviewOnly: true,
    noExecutionControls: true,
    safety: {
      decisionAssistOnly: true,
      monitorOnly: true,
      diagnosticsOnly: true,
      reviewOnly: true,
      liveTradingAllowed: false,
      autoTradingAllowed: false,
      accountMutationAllowed: false,
      brokerOrderPlacementAllowed: false,
      brokerContactAllowed: false,
      operatorCanPlaceOrderFromPanel: false
    },
    summary: {
      packetStatus: packet.status ?? "unknown",
      packetType: packet.packetType ?? "operator_review_packet",
      finalDecision: reviewDecision.finalDecision ?? "NO_GO_FOR_ORDER_PLACEMENT",
      canApproveOrderPlacement: false,
      canContactBroker: false,
      canMutateAccount: false,
      artifactCount: Object.keys(artifacts).length,
      warningCount: warnings.length,
      blockerCount: blockers.length
    },
    badges: [
      badge("Mode", "Decision Assist", "safe"),
      badge("Panel", "Review Only", "safe"),
      badge("Broker Contact", "Blocked", "blocked"),
      badge("Order Placement", "Blocked", "blocked"),
      badge("Warnings", String(warnings.length), warnings.length ? "warn" : "safe"),
      badge("Blockers", String(blockers.length), blockers.length ? "blocked" : "safe")
    ],
    checklist: asArray(packet.checklist),
    artifacts,
    warnings,
    blockers,
    actions: [
      { id: "review_packet", label: "Review packet only", enabled: true, mutation: false, brokerContact: false, orderPlacement: false },
      { id: "place_order", label: "Place order", enabled: false, mutation: false, brokerContact: false, orderPlacement: false },
      { id: "contact_broker", label: "Contact broker", enabled: false, mutation: false, brokerContact: false, orderPlacement: false }
    ],
    nextActions: [
      "review_packet_only",
      "keep_decision_assist_only",
      "do_not_place_orders_without_separate_future_approval"
    ]
  };

  return panel;
}

export function renderPaperAttemptOperatorReviewPacketPanelHtml(options = {}) {
  const panel = buildPaperAttemptOperatorReviewPacketPanel(options);
  const badges = panel.badges.map((item) => `<span class="badge ${safeText(item.tone)}"><b>${safeText(item.label)}</b>: ${safeText(item.value)}</span>`).join("\n");
  const blockers = panel.blockers.length
    ? panel.blockers.map((item) => `<li>${safeText(item)}</li>`).join("\n")
    : "<li>none</li>";
  const artifacts = Object.entries(panel.artifacts)
    .map(([key, value]) => `<li><b>${safeText(key)}</b>: ${safeText(value?.present ? value.latestPath : "missing")}</li>`)
    .join("\n");
  const checklist = panel.checklist.length
    ? panel.checklist.map((item) => `<li>${safeText(item.id ?? item.label ?? "check")}: ${safeText(item.passed === true ? "pass" : "blocked")}</li>`).join("\n")
    : "<li>no checklist rows</li>";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeText(panel.title)}</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:24px;line-height:1.4;background:#fafafa;color:#111}.card{max-width:980px;background:white;border:1px solid #ddd;border-radius:14px;padding:20px;box-shadow:0 2px 14px #0001}.badge{display:inline-block;margin:4px 6px 4px 0;padding:6px 10px;border-radius:999px;background:#eee}.safe{background:#e8f7ee}.blocked{background:#fdecec}.warn{background:#fff7df}code{background:#f4f4f4;padding:2px 5px;border-radius:5px}ul{padding-left:22px}.lock{font-weight:700}</style>
</head><body><main class="card">
<h1>${safeText(panel.title)}</h1>
<p>${safeText(panel.subtitle)}</p>
<p class="lock">Final decision: ${safeText(panel.summary.finalDecision)}</p>
<section>${badges}</section>
<h2>Safety</h2><ul>
<li>Decision assist only: true</li>
<li>Review only: true</li>
<li>Broker contact allowed: false</li>
<li>Order placement allowed: false</li>
<li>Account mutation allowed: false</li>
</ul>
<h2>Blockers</h2><ul>${blockers}</ul>
<h2>Checklist</h2><ul>${checklist}</ul>
<h2>Artifacts</h2><ul>${artifacts}</ul>
<p>Automation command format remains: <code>: GS_RUN_B64_V1; ~/bin/gsremote '&lt;base64-payload&gt;'</code></p>
</main></body></html>`;
}

export default buildPaperAttemptOperatorReviewPacketPanel;
