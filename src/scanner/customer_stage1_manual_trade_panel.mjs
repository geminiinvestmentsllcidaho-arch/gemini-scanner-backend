import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_stage1_manual_trade_panel_v1";
export const DEFAULT_STATUS_PATH = path.join(process.cwd(), "runs", "paper_manual_round_trip_status.json");
const clean = (value) => String(value ?? "").trim();
function readJson(filePath) { try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return null; } }

export function buildCustomerStage1ManualTradePanel(options = {}) {
  const nowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  const source = options.status ?? readJson(options.statusPath ?? DEFAULT_STATUS_PATH);
  const observedAt = clean(source?.observedAt) || null;
  const parsed = observedAt ? Date.parse(observedAt) : NaN;
  const ageMs = Number.isFinite(parsed) ? Math.max(0, nowMs - parsed) : null;
  const watcherFresh = Number.isFinite(ageMs) && ageMs <= 45000;
  const operator = source?.operator ?? {};
  const tracker = source?.tracker ?? {};
  const safety = source?.safety ?? operator?.safety ?? {};
  const marketOpen = options.marketOpen === true;
  const connectedReadonly = source?.ok === true && watcherFresh && safety.readOnly === true && safety.orderPlacementAllowed === false;
  const baselineReady = tracker.baselineObserved === true && operator.positionsKnown === true && operator.positionsCount === 0 && operator.openOrdersKnown === true && operator.openOrdersCount === 0;
  const entryReady = marketOpen && connectedReadonly && baselineReady && operator.operatorState === "WAITING_FOR_MANUAL_ONE_SHARE_ENTRY";
  const entered = tracker.enterDetected === true;
  const exited = tracker.exitDetected === true;
  const complete = tracker.mechanicalSuccess === true;
  let phase = "blocked", headline = "Stage 1 is not ready", instruction = "Restore the fresh read-only paper-account watcher before continuing.";
  if (!marketOpen) { phase = "market_closed"; headline = "Stage 1 waiting for market open"; instruction = "Do not submit the manual paper order while the market is closed."; }
  else if (entryReady) { phase = "ready_for_manual_entry"; headline = "Ready for your manual one-share paper entry"; instruction = "In Alpaca Paper, manually buy exactly one long share. GeminiScanner will only observe and reconcile it."; }
  else if (entered && !exited) { phase = "monitoring_position"; headline = `Monitoring your manual ${clean(tracker.symbol) || "paper"} position`; instruction = "Keep the position open while GeminiScanner monitors it. Close exactly that one share manually when the EXIT review is triggered."; }
  else if (exited && !complete) { phase = "reconciling_exit"; headline = "Manual exit detected; completing reconciliation"; instruction = "Do not place another order while recovery and duplicate-protection checks complete."; }
  else if (complete) { phase = "complete"; headline = "Stage 1 manual round trip mechanically proven"; instruction = "Stage 2 remains locked until a separate explicit unlock."; }
  return Object.freeze({ version: VERSION, phase, headline, instruction, marketOpen, watcherFresh, watcherAgeMs: ageMs, connectedReadonly, baselineReady, entryReady, symbol: clean(tracker.symbol) || null, cycle: source?.cycle ?? null, observedAt, operatorState: operator.operatorState ?? null, positionsCount: operator.positionsCount ?? null, openOrdersCount: operator.openOrdersCount ?? null, enterDetected: entered, enterReconciled: tracker.enterReconciled === true, monitoringStarted: tracker.monitoringStarted === true, exitDetected: exited, exitReconciled: tracker.exitReconciled === true, roundTripClosed: tracker.roundTripClosed === true, restartRecoveryVerified: tracker.restartRecoveryVerified === true, duplicateProtectionVerified: tracker.duplicateProtectionVerified === true, mechanicalSuccess: complete, issues: Object.freeze(Array.isArray(tracker.issues) ? [...tracker.issues] : []), safety: Object.freeze({ readOnly: true, getOnly: true, orderPlacementAllowed: false, accountMutationAllowed: false, stage2Locked: true, stage3Locked: true }) });
}

export function renderCustomerStage1ManualTradePanelHtml(panel = {}) {
  const esc = (value) => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const check = (label, value) => `<li class="${value ? "pass" : "hold"}"><strong>${value ? "PASS" : "HOLD"}</strong> ${esc(label)}</li>`;
  const phaseClass = panel.phase === "complete" ? "stage1-complete" : panel.phase === "ready_for_manual_entry" ? "stage1-ready" : panel.phase === "monitoring_position" ? "stage1-monitoring" : "stage1-hold";
  return `<section class="card panel stage1-panel ${phaseClass}" data-stage1-manual-panel data-stage1-phase="${esc(panel.phase)}"><p class="stage1-kicker">Stage 1 • Manual paper ENTER and EXIT</p><h2>${esc(panel.headline)}</h2><p><strong>Next step:</strong> ${esc(panel.instruction)}</p><ul class="stage1-checks">${check("Market is open", panel.marketOpen)}${check("Watcher status is fresh", panel.watcherFresh)}${check("Read-only paper-account access is healthy", panel.connectedReadonly)}${check("Zero-position baseline is ready", panel.baselineReady)}${check("Stage 2 remains locked", panel.safety?.stage2Locked === true)}${check("Stage 3 remains locked", panel.safety?.stage3Locked === true)}</ul><div class="stage1-grid"><p><span>Watcher cycle</span><strong>${esc(panel.cycle ?? "No data")}</strong></p><p><span>Positions</span><strong>${esc(panel.positionsCount ?? "Unknown")}</strong></p><p><span>Open orders</span><strong>${esc(panel.openOrdersCount ?? "Unknown")}</strong></p><p><span>Detected symbol</span><strong>${esc(panel.symbol ?? "Waiting")}</strong></p><p><span>ENTER reconciled</span><strong>${panel.enterReconciled ? "Yes" : "No"}</strong></p><p><span>EXIT reconciled</span><strong>${panel.exitReconciled ? "Yes" : "No"}</strong></p></div>${panel.issues?.length ? `<p class="stage1-issues"><strong>Issues:</strong> ${panel.issues.map(esc).join(", ")}</p>` : ""}<p class="helper">Paper-only, GET-only observation. GeminiScanner cannot submit, cancel, replace, or modify any broker order from this panel.</p></section>`;
}
