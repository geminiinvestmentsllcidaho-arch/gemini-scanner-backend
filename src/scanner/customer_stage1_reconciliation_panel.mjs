export const VERSION = "customer_stage1_reconciliation_panel_v1";

const finite = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const clean = (value) => String(value ?? "").trim();

function delta(after, before) {
  const a = finite(after);
  const b = finite(before);
  return a === null || b === null ? null : a - b;
}

function money(value, locale = "en-US") {
  const number = finite(value);
  if (number === null) return "Waiting";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(number);
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildCustomerStage1ReconciliationPanel(options = {}) {
  const status = options.status ?? {};
  const tracker = status.tracker ?? {};
  const operator = status.operator ?? {};
  const baseline = tracker.baselineAccount ?? tracker.baseline ?? {};
  const entry = tracker.entryAccount ?? tracker.enterAccount ?? {};
  const exit = tracker.exitAccount ?? {};
  const symbol = clean(tracker.symbol ?? operator.symbol) || null;

  return Object.freeze({
    version: VERSION,
    observedAt: status.observedAt ?? null,
    cycle: status.cycle ?? null,
    symbol,
    phase: operator.operatorState ?? "WAITING_FOR_READONLY_ACCOUNT",
    entry: Object.freeze({
      detected: tracker.enterDetected === true,
      reconciled: tracker.enterReconciled === true,
      quantity: finite(tracker.enterQty ?? tracker.quantity ?? tracker.qty),
      averageEntryPrice: finite(tracker.averageEntryPrice ?? tracker.entryAveragePrice),
      cashDelta: delta(entry.cash, baseline.cash),
      buyingPowerDelta: delta(entry.buyingPower, baseline.buyingPower),
      equityDelta: delta(entry.equity, baseline.equity),
      portfolioValueDelta: delta(entry.portfolioValue, baseline.portfolioValue),
    }),
    exit: Object.freeze({
      detected: tracker.exitDetected === true,
      reconciled: tracker.exitReconciled === true,
      cashDelta: delta(exit.cash, entry.cash),
      buyingPowerDelta: delta(exit.buyingPower, entry.buyingPower),
      equityDelta: delta(exit.equity, entry.equity),
      portfolioValueDelta: delta(exit.portfolioValue, entry.portfolioValue),
    }),
    recovery: Object.freeze({
      restartRecoveryVerified: tracker.restartRecoveryVerified === true,
      duplicateProtectionVerified: tracker.duplicateProtectionVerified === true,
      roundTripClosed: tracker.roundTripClosed === true,
      mechanicalSuccess: tracker.mechanicalSuccess === true,
    }),
    alerts: Object.freeze({
      visualExitAlertReady: true,
      audioExitAlertReady: true,
      requiresUserGestureForAudio: true,
      automaticExitAllowed: false,
    }),
    safety: Object.freeze({
      readOnly: true,
      getOnly: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      stage2Locked: true,
      stage3Locked: true,
    }),
  });
}

export function renderCustomerStage1ReconciliationPanelHtml(panel = {}, locale = "en-US") {
  const state = (label, value) => `<li class="${value ? "pass" : "pending"}"><strong>${value ? "PASS" : "PENDING"}</strong> ${esc(label)}</li>`;
  const metric = (label, value) => `<p><span>${esc(label)}</span><strong>${esc(money(value, locale))}</strong></p>`;
  return `<section class="card panel stage1-reconciliation" data-stage1-reconciliation>
<p class="stage1-kicker">Stage 1 • Manual round-trip reconciliation</p>
<h2>Entry, monitoring, exit, and completion proof</h2>
<p><strong>Current phase:</strong> ${esc(panel.phase)}</p>
<p><strong>Detected symbol:</strong> ${esc(panel.symbol ?? "Waiting")}</p>
<div class="stage1-recon-columns">
<article><h3>Manual ENTER</h3><ul>${state("Entry detected", panel.entry?.detected)}${state("Entry reconciled", panel.entry?.reconciled)}</ul>
${metric("Cash change", panel.entry?.cashDelta)}${metric("Buying-power change", panel.entry?.buyingPowerDelta)}${metric("Equity change", panel.entry?.equityDelta)}${metric("Portfolio-value change", panel.entry?.portfolioValueDelta)}</article>
<article><h3>Manual EXIT</h3><ul>${state("Exit detected", panel.exit?.detected)}${state("Exit reconciled", panel.exit?.reconciled)}</ul>
${metric("Cash change", panel.exit?.cashDelta)}${metric("Buying-power change", panel.exit?.buyingPowerDelta)}${metric("Equity change", panel.exit?.equityDelta)}${metric("Portfolio-value change", panel.exit?.portfolioValueDelta)}</article>
<article><h3>Completion gates</h3><ul>${state("Round trip closed", panel.recovery?.roundTripClosed)}${state("Restart recovery verified", panel.recovery?.restartRecoveryVerified)}${state("Duplicate protection verified", panel.recovery?.duplicateProtectionVerified)}${state("Mechanical proof complete", panel.recovery?.mechanicalSuccess)}</ul></article>
</div>
<div class="stage1-alert-readiness" role="status"><strong>EXIT alert readiness:</strong> visual alert ready; audio alert ready after browser permission/user gesture. Manual review only — no system-initiated sale.</div>
<p class="helper">Read-only, GET-only evidence. GeminiScanner cannot submit, cancel, replace, or modify an Alpaca order from this panel. Stage 2 and Stage 3 remain locked.</p>
</section>`;
}

export default {
  VERSION,
  buildCustomerStage1ReconciliationPanel,
  renderCustomerStage1ReconciliationPanelHtml,
};
