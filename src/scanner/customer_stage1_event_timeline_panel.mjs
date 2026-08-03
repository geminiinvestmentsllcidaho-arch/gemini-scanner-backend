const VERSION = "customer_stage1_event_timeline_panel_v1";
const clean = (value) => String(value ?? "").trim();
const esc = (value) => String(value ?? "—").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function validTime(value) {
  const text = clean(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

function elapsedMs(end, start) {
  const endMs = Date.parse(end ?? "");
  const startMs = Date.parse(start ?? "");
  return Number.isFinite(endMs) && Number.isFinite(startMs) && endMs >= startMs
    ? endMs - startMs
    : null;
}

function durationLabel(value) {
  if (!Number.isFinite(value)) return "Pending";
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} sec`;
  return `${(value / 60000).toFixed(1)} min`;
}

export function buildCustomerStage1EventTimelinePanel(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const proof = status.promotionProof ?? {};
  const baselineAt = validTime(tracker.baselineObservedAt);
  const entryAt = validTime(tracker.enterDetectedAt);
  const exitAt = validTime(tracker.exitDetectedAt);
  const completedAt = validTime(proof.completedAt);
  const baselineObserved = tracker.baselineObserved === true;
  const entryDetected = tracker.enterDetected === true;
  const exitDetected = tracker.exitDetected === true;
  const complete = tracker.mechanicalSuccess === true && proof.mechanicalSuccess === true;

  const events = Object.freeze([
    Object.freeze({
      id: "baseline",
      label: "Protected zero-position baseline",
      state: baselineObserved ? "complete" : "pending",
      occurredAt: baselineAt,
      elapsedFromPriorMs: null,
    }),
    Object.freeze({
      id: "entry",
      label: "Manual one-share entry detected",
      state: entryDetected ? "complete" : "pending",
      occurredAt: entryAt,
      elapsedFromPriorMs: elapsedMs(entryAt, baselineAt),
    }),
    Object.freeze({
      id: "exit",
      label: "Manual exit detected",
      state: exitDetected ? "complete" : "pending",
      occurredAt: exitAt,
      elapsedFromPriorMs: elapsedMs(exitAt, entryAt),
    }),
    Object.freeze({
      id: "completion",
      label: "Mechanical proof completed",
      state: complete ? "complete" : "pending",
      occurredAt: completedAt,
      elapsedFromPriorMs: elapsedMs(completedAt, exitAt),
    }),
  ]);

  const timestampConflict =
    (entryDetected && !entryAt) ||
    (exitDetected && !exitAt) ||
    (complete && !completedAt) ||
    (entryAt && baselineAt && Date.parse(entryAt) < Date.parse(baselineAt)) ||
    (exitAt && entryAt && Date.parse(exitAt) < Date.parse(entryAt)) ||
    (completedAt && exitAt && Date.parse(completedAt) < Date.parse(exitAt));

  return Object.freeze({
    version: VERSION,
    visible: baselineObserved,
    state: timestampConflict ? "stop" : complete ? "complete" : exitDetected ? "reconciling" : entryDetected ? "monitoring" : "awaiting_entry",
    headline: timestampConflict
      ? "STOP — Stage 1 event timing evidence is inconsistent."
      : complete
        ? "Stage 1 event timeline is complete."
        : "Stage 1 event timeline is recording live evidence.",
    events,
    timestampConflict,
    safety: Object.freeze({
      readOnly: true,
      paperOnly: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

export function renderCustomerStage1EventTimelinePanelHtml(panel = {}) {
  if (panel.visible !== true) return "";
  const items = (panel.events ?? []).map((event) => `
<li class="${event.state === "complete" ? "pass" : "hold"}" data-stage1-event="${esc(event.id)}">
  <span>${esc(event.label)}</span>
  <strong>${event.state === "complete" ? "RECORDED" : "PENDING"}</strong>
  <small>${esc(event.occurredAt ?? "Waiting for event")}</small>
  <small>${esc(event.id === "baseline" ? "Starting point" : durationLabel(event.elapsedFromPriorMs))}</small>
</li>`).join("");
  return `<section class="card panel stage1-event-timeline stage1-event-${esc(panel.state)}" data-stage1-event-timeline data-stage1-event-timeline-state="${esc(panel.state)}">
<p class="stage1-kicker">Stage 1 • Event timeline</p>
<h2>${esc(panel.headline)}</h2>
<ol class="stage1-event-list">${items}</ol>
<p class="helper">Immutable read-only evidence. This panel cannot contact Alpaca, place an order, change the paper account, or unlock Stage 2 or Stage 3.</p>
</section>`;
}
