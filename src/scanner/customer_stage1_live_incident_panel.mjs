const VERSION = "customer_stage1_live_incident_panel_v1";
const clean = (value) => String(value ?? "").trim();
const freeze = (value) => Object.freeze(value);
const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

const INCIDENT_LABELS = Object.freeze({
  watcher_status_stale_or_missing: "Watcher status is stale or missing",
  readonly_watcher_unhealthy: "Read-only watcher is unhealthy",
  positions_snapshot_unavailable: "Positions snapshot is unavailable",
  open_orders_snapshot_unavailable: "Open-orders snapshot is unavailable",
  unexpected_open_orders_present: "Unexpected open orders are present",
  more_than_one_position_present: "More than one position is present",
  position_quantity_must_equal_one_share: "Position quantity is not exactly one share",
  position_must_be_long: "Position side is not long",
  unexpected_position_symbol: "Detected position symbol does not match the protected Stage 1 symbol",
  manual_enter_must_be_exactly_one_long_share: "Manual entry evidence is not exactly one long share",
  manual_exit_requires_zero_open_orders: "Manual exit cannot reconcile while open orders remain",
  manual_position_changed_from_exactly_one_long_share: "The protected one-share position changed unexpectedly",
  manual_position_set_changed_during_monitoring: "The monitored position set changed unexpectedly",
  paper_account_snapshot_stale_or_missing: "Paper-account snapshot is stale or missing",
  paper_positions_unavailable: "Paper positions are unavailable",
  paper_open_orders_unavailable: "Paper open orders are unavailable",
  stage1_event_timestamp_conflict: "Stage 1 event timestamps are missing, reversed, or inconsistent",
});

export function buildCustomerStage1LiveIncidentPanel(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const operatorConsole = options.operatorConsole ?? {};
  const checklist = options.checklist ?? {};
  const timeline = options.timeline ?? {};
  const raw = [
    ...(Array.isArray(tracker.issues) ? tracker.issues : []),
    ...(Array.isArray(operatorConsole.anomalies) ? operatorConsole.anomalies : []),
    ...(Array.isArray(checklist.hardStops) ? checklist.hardStops : []),
    ...(timeline.timestampConflict === true ? ["stage1_event_timestamp_conflict"] : []),
  ].map(clean).filter(Boolean);
  const incidentCodes = [...new Set(raw)];
  const active = incidentCodes.length > 0;
  const capturedAt = clean(options.capturedAt) || null;
  const symbol = clean(tracker.symbol).toUpperCase() || clean(operatorConsole.expectedSymbol).toUpperCase() || null;

  return freeze({
    version: VERSION,
    visible: active,
    state: active ? "STOP" : "CLEAR",
    headline: active
      ? "STOP — Stage 1 live incident evidence captured."
      : "No Stage 1 live incident is active.",
    instruction: active
      ? "Do not place another paper order. Preserve the current evidence and resolve every listed condition before continuing."
      : "Continue to follow the protected Stage 1 control panel.",
    capturedAt,
    symbol,
    incidentCodes: freeze(incidentCodes),
    incidents: freeze(incidentCodes.map((code) => freeze({
      code,
      label: INCIDENT_LABELS[code] ?? code.replaceAll("_", " "),
    }))),
    snapshot: freeze({
      watcherObservedAt: status.observedAt ?? null,
      watcherCycle: status.cycle ?? null,
      positionsCount: operatorConsole.positionsCount ?? null,
      openOrdersCount: operatorConsole.openOrdersCount ?? null,
      operatorState: operatorConsole.state ?? null,
      checklistState: checklist.state ?? null,
      timelineState: timeline.state ?? null,
    }),
    safety: freeze({
      readOnly: true,
      paperOnly: true,
      evidenceCaptureOnly: true,
      brokerContactAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      evidenceResetAllowed: false,
      automaticStagePromotionAllowed: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

export function renderCustomerStage1LiveIncidentPanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  const incidents = (panel.incidents ?? []).map((incident) =>
    `<li><strong>${esc(incident.label)}</strong><code>${esc(incident.code)}</code></li>`
  ).join("");
  return `<section class="card panel stage1-live-incident stage1-operator-stop" role="alert" data-stage1-live-incident data-stage1-live-incident-state="${esc(panel.state)}">
<p class="stage1-kicker">Stage 1 • Live incident capture</p>
<h2>${esc(panel.headline)}</h2>
<p><strong>Required action:</strong> ${esc(panel.instruction)}</p>
<div class="stage1-grid"><p><span>Captured</span><strong>${esc(panel.capturedAt ?? "Current page observation")}</strong></p><p><span>Symbol</span><strong>${esc(panel.symbol ?? "Not established")}</strong></p><p><span>Watcher cycle</span><strong>${esc(panel.snapshot?.watcherCycle ?? "Unknown")}</strong></p><p><span>Positions</span><strong>${esc(panel.snapshot?.positionsCount ?? "Unknown")}</strong></p><p><span>Open orders</span><strong>${esc(panel.snapshot?.openOrdersCount ?? "Unknown")}</strong></p></div>
<div class="stage1-anomaly-banner"><strong>Captured incident conditions:</strong><ul>${incidents}</ul></div>
<p class="helper">Read-only incident evidence only. This panel cannot contact Alpaca, place or modify an order, reset Stage 1 evidence, or unlock Stage 2 or Stage 3.</p>
</section>`;
}

export default { VERSION, buildCustomerStage1LiveIncidentPanel, renderCustomerStage1LiveIncidentPanelHtml };
