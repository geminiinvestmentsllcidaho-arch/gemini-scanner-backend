import { buildPaperAttemptOperatorReviewPacketPanel, renderPaperAttemptOperatorReviewPacketPanelHtml } from "./scanner/paper_attempt_operator_review_packet_panel.mjs";
import { buildPaperAttemptOperatorReviewPacketAppScreen, renderPaperAttemptOperatorReviewPacketAppScreenHtml } from "./scanner/paper_attempt_operator_review_packet_app_screen.mjs";
import { buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen, renderPaperAttemptOperatorReviewPacketAuditDashboardAppScreenHtml } from "./scanner/paper_attempt_operator_review_packet_audit_dashboard_app_screen.mjs";
import { buildPaperAttemptModuleCompleteSelectorAppScreen, renderPaperAttemptModuleCompleteSelectorAppScreenHtml } from "./scanner/paper_attempt_module_complete_selector_app_screen.mjs";
import { buildPaperAttemptControlCenterPanel, buildPaperAttemptControlCenterPanelHtml } from "./scanner/paper_attempt_control_center_panel.mjs";
import { buildPaperAttemptControlCenterAppScreen, renderPaperAttemptControlCenterAppScreenHtml } from "./scanner/paper_attempt_control_center_app_screen.mjs";
import { buildPaperAttemptControlCenter } from "./scanner/paper_attempt_control_center.mjs";
import { getPaperTradeIntentPlan } from "./scanner/paper_trade_intent_planner.mjs";
import { buildPaperTradeIntentPlanAppScreen, renderPaperTradeIntentPlanAppScreenHtml } from "./scanner/paper_trade_intent_plan_app_screen.mjs";
import { getPaperTradingReadinessGate } from "./scanner/paper_trading_readiness_gate.mjs";
import { buildPaperReadinessGateAppScreen, renderPaperReadinessGateAppScreenHtml } from "./scanner/paper_readiness_gate_app_screen.mjs";
import { buildAlpacaPaperAccountStatusAppScreen, renderAlpacaPaperAccountStatusAppScreenHtml } from "./scanner/alpaca_paper_account_status_app_screen.mjs";
import { buildOperatorApprovalDashboardPanel } from './scanner/operator_approval_dashboard_panel.mjs';
import fs from "node:fs";
import dotenv from 'dotenv';
import express from 'express';
import { startMarketDataStream } from './market_data_stream.js';
import { marketDataDump } from './utils/market_data_dump.js';
import { getDiagnostics } from './diagnostics/index.js';
import { health, readiness } from './utils/health.js';
import { getAlpacaRequestAudit } from "./utils/alpaca_request_audit.mjs";
import { getStreamTelemetry } from './utils/stream_telemetry.js';
import { nextStep } from './next-step.js';

import { buildLiveSnapshot } from './utils/live_snapshot.js';
import { buildBarsByTfFrom1m } from './pillar3/aggregate_bars.mjs';

import { getCoaching } from './pillar2/coaching_engine.js';
import { computeContext as computeContextV3 } from './pillar3/context_engine.mjs';
import { writeRunlog } from './runlog-write.js';
import { listRuns, readRun, runlogIndex } from './utils/runlog_index.js';
import { readScannerRankings } from './scanner/ranking_store.mjs';
import { createRequireOperatorDashboardAuth, registerOperatorDashboardRoutes } from './operator/operator_dashboard.mjs';
import { buildPaperTradeIntentDashboardPanel } from './scanner/paper_trade_intent_dashboard.mjs';
import { buildPaperTradeIntentAuditDashboard } from './scanner/paper_trade_intent_audit_dashboard.mjs';
import { getPaperTradeIntentAuditDashboardPanel } from "./scanner/paper_trade_intent_audit_dashboard_panel.mjs";
import { readPaperTradeIntentCreationDashboard } from './scanner/paper_trade_intent_creation_dashboard.mjs';
import { readPaperTradeIntentCreationDashboardPanel } from './scanner/paper_trade_intent_creation_dashboard_panel.mjs';
import { previewPaperTradeIntentCreationFromPlan } from './scanner/paper_trade_intent_creation_runner.mjs';
import { readPaperTradeIntentCreationRunnerPanel } from './scanner/paper_trade_intent_creation_runner_panel.mjs';
import { readPaperTradeIntentCreationRunnerAuditDashboard } from './scanner/paper_trade_intent_creation_runner_audit.mjs';
import { readPaperTradeIntentCreationRunnerAuditPanel } from './scanner/paper_trade_intent_creation_runner_audit_panel.mjs';
import { buildPaperTradeExecutionPayloadPreview, buildPaperTradeExecutionPayloadPreviewPanel } from './scanner/paper_trade_execution_payload_preview.mjs';
import { buildPaperTradeSizingPreview, buildPaperTradeSizingPreviewPanel } from './scanner/paper_trade_sizing_preview.mjs';
import { buildPaperTradeOrderTicketPreview, buildPaperTradeOrderTicketPreviewPanel } from './scanner/paper_trade_order_ticket_preview.mjs';
import { readPaperTradeOrderTicketStoreDashboard } from './scanner/paper_trade_order_ticket_store.mjs';
import { readPaperTradeOrderTicketStorePanel } from './scanner/paper_trade_order_ticket_store_panel.mjs';
import { buildPaperTradeFillSimulationPreview, buildPaperTradeFillSimulationPreviewPanel } from './scanner/paper_trade_fill_simulation_preview.mjs';
import { readPaperTradeFillSimulationStoreDashboard } from './scanner/paper_trade_fill_simulation_store.mjs';
import { readPaperTradeFillSimulationStorePanel } from './scanner/paper_trade_fill_simulation_store_panel.mjs';
import { buildPaperTradePositionStatePreview, buildPaperTradePositionStatePreviewPanel } from './scanner/paper_trade_position_state_preview.mjs';
import { readPaperTradePositionStateStoreDashboard } from './scanner/paper_trade_position_state_store.mjs';
import { readPaperTradePositionStateStorePanel } from './scanner/paper_trade_position_state_store_panel.mjs';
import { readPaperTradeLifecycleDashboard, readPaperTradeLifecycleDashboardPanel } from './scanner/paper_trade_lifecycle_dashboard.mjs';
import { previewPaperTradeLifecycleRun, readPaperTradeLifecycleRunnerPanel } from './scanner/paper_trade_lifecycle_runner.mjs';
import { readPaperTradeLifecycleRunnerAuditDashboard } from './scanner/paper_trade_lifecycle_runner_audit.mjs';
import { readPaperTradeLifecycleRunnerAuditPanel } from './scanner/paper_trade_lifecycle_runner_audit_panel.mjs';
import { evaluatePaperTradeBrokerAdapterGuard, readPaperTradeBrokerAdapterGuardPanel } from './scanner/paper_trade_broker_adapter_guard.mjs';
import { evaluatePaperTradeExecutionControlStack, readPaperTradeExecutionControlStackPanel } from './scanner/paper_trade_execution_control_stack.mjs';
import { buildPaperTradeReadinessReport, buildPaperTradeReadinessReportPanel } from './scanner/paper_trade_readiness_report.mjs';
import { evaluatePaperTradeBrokerIntegrationPreflightStack, readPaperTradeBrokerIntegrationPreflightStackPanel } from './scanner/paper_trade_broker_integration_preflight_stack.mjs';
import { buildPaperTradeModuleCompletionReport, buildPaperTradeModuleCompletionReportPanel } from './scanner/paper_trade_module_completion_report.mjs';
import { buildPaperTradeOperatorGoNoGo, buildPaperTradeOperatorGoNoGoPanel } from './scanner/paper_trade_operator_go_no_go.mjs';

import { buildPaperBrokerAdapterApprovalLock } from './scanner/paper_broker_adapter_approval_lock.mjs';

import { buildPaperBrokerAdapterApprovalLockPanel } from './scanner/paper_broker_adapter_approval_lock_panel.mjs';
import { getPaperBrokerNullAdapterDiagnostics } from './scanner/paper_broker_null_adapter.mjs';
import { getPaperBrokerAdapterContractDiagnostics } from './scanner/paper_broker_adapter_contract.mjs';
import { getPaperOrderIntentAdapterPreviewBridgeDiagnostics } from './scanner/paper_order_intent_adapter_preview_bridge.mjs';
import { getPaperBrokerAdapterApprovalRecordDiagnostics } from './scanner/paper_broker_adapter_approval_record_tool.mjs';
import { buildPaperBrokerAdapterApprovalRecordToolAppScreen, renderPaperBrokerAdapterApprovalRecordToolAppScreenHtml } from './scanner/paper_broker_adapter_approval_record_tool_app_screen.mjs';
import { getAlpacaPaperBrokerAdapterDiagnostics } from './scanner/alpaca_paper_broker_adapter.mjs';
import { getPaperOrderSubmitDryRunDiagnostics } from './scanner/paper_order_submit_dry_run_preview.mjs';
import { getPaperTradingFinalGoNoGoDiagnostics } from './scanner/paper_trading_final_go_no_go.mjs';
import { getFirstRealPaperOrderTestGateDiagnostics } from './scanner/first_real_paper_order_test_gate.mjs';
import { getPaperTradingMonitoringDiagnostics } from './scanner/paper_trading_monitoring_kill_switch.mjs';
import { getRealTradingConversionLockDiagnostics } from './scanner/real_trading_conversion_lock.mjs';
import { buildMarketClosedSnapshotDiagnostics, buildMarketClosedSnapshotPanel } from "./scanner/market_closed_scanner_snapshot_diagnostics.mjs";
import { buildMarketClosedSnapshotAppScreen, renderMarketClosedSnapshotAppScreenHtml } from "./scanner/market_closed_snapshot_app_screen.mjs";
import { appendMarketClosedSnapshotRecord } from "./scanner/market_closed_scanner_snapshot_store.mjs";
import { getStoreHistory, getStorePanel } from "./scanner/market_closed_scanner_snapshot_store_reader.mjs";
import { buildSnapshotStoreAppScreen, renderSnapshotStoreAppScreenHtml } from "./scanner/snapshot_store_app_screen.mjs";
import { buildSnapshotHistoryAppScreen, renderSnapshotHistoryAppScreenHtml } from "./scanner/snapshot_history_app_screen.mjs";
import { buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics, buildMarketClosedSnapshotStoreRetentionCleanupPanel } from "./scanner/market_closed_snapshot_store_retention_cleanup_diagnostics.mjs";
import { buildRetentionCleanupAppScreen, renderRetentionCleanupAppScreenHtml } from "./scanner/retention_cleanup_app_screen.mjs";
import { buildTodaysIntradaySetups } from "./scanner/todays_intraday_setups.mjs";
import { buildTodaysIntradaySetupsAppCard, renderTodaysIntradaySetupsAppCardHtml } from "./scanner/todays_intraday_setups_app_card.mjs";
import { buildTodaysIntradaySetupDetailAppCard, renderTodaysIntradaySetupDetailAppCardHtml } from "./scanner/todays_intraday_setup_detail_app_card.mjs";
import { buildAppNavigationReadonly, renderAppNavigationReadonlyHtml } from "./scanner/app_navigation_readonly.mjs";
import { buildWatchlistSettingsReadonly, renderWatchlistSettingsReadonlyHtml } from "./scanner/watchlist_settings_readonly.mjs";
import { buildExitAllControlReadonly, renderExitAllControlReadonlyHtml } from "./scanner/exit_all_control_readonly.mjs";
import { enrichScannerRankingWithIntradayFeatures } from "./scanner/intraday_feature_enrichment.mjs";
import { buildPaperOperatorStartHereAppScreen, renderPaperOperatorStartHereAppScreenHtml } from "./scanner/paper_operator_start_here_app_screen.mjs";
import { buildInternalOwnerTenantReadonly } from "./scanner/internal_owner_tenant_readonly.mjs";
import { buildInternalOwnerTenantCredentialStoreStatus } from "./scanner/internal_owner_tenant_credential_store.mjs";
import { createRequireInternalOwnerAuthorization } from "./scanner/internal_owner_authorization.mjs";
import { createRequireInternalOwnerTenantIsolation } from "./scanner/internal_owner_tenant_isolation.mjs";
import { buildInternalOwnerTenantAppScreen, renderInternalOwnerTenantAppScreenHtml } from "./scanner/internal_owner_tenant_app_screen.mjs";

dotenv.config();


async function buildStage2LcmPayload() {
  const rankings = await readScannerRankings()
  return {
    version: 'stage2_lcm_payload_v1',
    scannerHealth: rankings.scannerHealth,
    rankingConfidence: rankings.rankingConfidence,
    stage2FinalCommand: rankings.stage2FinalCommand,
    stage2FinalPermission: rankings.stage2FinalPermission,
    decisionAssistCommand: rankings.decisionAssistCommand,
    userDecisionSummary: rankings.userDecisionSummary,
    lcmHeadline: rankings.lcmHeadline,
    actionCardPrimary: rankings.actionCardPrimary,
    coachingNarrative: rankings.coachingNarrative,
    stage2AppDisplay: rankings.stage2AppDisplay,
    stage2MobileDecisionCard: rankings.stage2MobileDecisionCard,
    stage2AppScreenPayload: rankings.stage2AppScreenPayload
  }
}

function attachStage2ToCoachingOutput(out, stage2Payload) {
  if (Array.isArray(out)) {
    return {
      ok: true,
      coaching: out,
      stage2Lcm: stage2Payload
    }
  }

  if (out && typeof out === 'object') {
    return {
      ...out,
      stage2Lcm: stage2Payload
    }
  }

  return {
    ok: true,
    coaching: [],
    rawCoachingOutput: out,
    stage2Lcm: stage2Payload
  }
}

const app = express();
function paperDiagnosticBool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function paperDiagnosticText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizePaperDiagnosticSafetyAliases(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.ok === false) {
    return payload;
  }

  const safety = payload.safety && typeof payload.safety === 'object' ? payload.safety : {};
  const status = paperDiagnosticText(
    payload.status,
    paperDiagnosticText(
      payload.finalStatus,
      paperDiagnosticText(
        payload.moduleStatus,
        paperDiagnosticText(payload.lifecycleStatus, 'readonly_no_go')
      )
    )
  );
  const displayState = paperDiagnosticText(
    payload.displayState,
    String(status).toUpperCase().replaceAll('-', '_')
  );

  return {
    ...payload,
    status,
    displayState,
    finalDecision: paperDiagnosticText(payload.finalDecision, 'NO_GO_FOR_ORDER_PLACEMENT'),
    readyForOrderPlacement: paperDiagnosticBool(payload.readyForOrderPlacement, false),
    readOnly: paperDiagnosticBool(payload.readOnly, true),
    monitorOnly: paperDiagnosticBool(payload.monitorOnly, true),
    noExecutionControls: paperDiagnosticBool(payload.noExecutionControls, true),
    brokerContactAllowed: paperDiagnosticBool(payload.brokerContactAllowed ?? safety.brokerContactAllowed ?? safety.brokerContact, false),
    orderPlacementAllowed: paperDiagnosticBool(payload.orderPlacementAllowed ?? safety.orderPlacementAllowed ?? safety.orderPlacement, false),
    accountMutationAllowed: paperDiagnosticBool(payload.accountMutationAllowed ?? safety.accountMutationAllowed ?? safety.accountMutation, false)
  };
}

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (
      req.method === 'GET' &&
      typeof req.path === 'string' &&
      req.path.startsWith('/diagnostics/') &&
      /paper/i.test(req.path)
    ) {
      return originalJson(normalizePaperDiagnosticSafetyAliases(payload));
    }
    return originalJson(payload);
  };
  next();
});



app.get('/app/paper-app-readiness-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_readiness_status_app_screen.mjs');
    const screen = mod.buildPaperAppReadinessStatusAppScreen({});
    res.type('html').send(mod.renderPaperAppReadinessStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_app_readiness_status_app_screen_failed', message: err?.message ?? String(err) });
  }
});


const API_PATCH_PLAN_DASHBOARD_ROUTE = "/diagnostics/alpaca-api-patch-plan";

app.get(API_PATCH_PLAN_DASHBOARD_ROUTE, async (_req, res) => {
  try {
    const { readApiPatchPlanForDashboard } = await import("./scanner/api_patch_plan_dashboard.mjs");
    res.json(await readApiPatchPlanForDashboard());
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "API_PATCH_PLAN_DASHBOARD_ERROR",
      message: err?.message ?? String(err)
    });
  }
});

app.use(express.json());

const P3_ENABLED = process.env.P3_ENABLED === '1';

// --------------------
// Health / Readiness / Diagnostics / Marketdata / Runlog
// --------------------
app.get('/', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner | Paper Trading Readiness</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#070b12;color:#eef4ff}
main{max-width:1100px;margin:auto;padding:28px 18px 42px}.brand{font-weight:800;color:#b9c8ff;letter-spacing:.04em}.hero{padding:42px 0 28px}.pill{display:inline-block;border:1px solid #2f4b68;border-radius:999px;padding:8px 12px;background:#0b1420;color:#c7d7ff}
h1{font-size:clamp(34px,6vw,64px);line-height:1;margin:18px 0 14px}.lead{max-width:820px;color:#c7d2e4;font-size:20px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(12,1fr);gap:16px}.card{grid-column:span 4;background:linear-gradient(180deg,#111a27,#0c111a);border:1px solid #243044;border-radius:20px;padding:20px}.wide{grid-column:span 8}.full{grid-column:1/-1}
.k{font-size:12px;color:#9ca8b8;text-transform:uppercase;letter-spacing:.12em}.v{font-size:28px;font-weight:850;margin-top:8px}.ok{color:#45d483}.warn{color:#f5c542}p,ul{color:#d7e2f2;line-height:1.65}ul{padding-left:20px}.links{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}a{color:#9ee4ff;text-decoration:none;border:1px solid #27435a;border-radius:12px;padding:12px;background:#0b1420}footer{margin-top:28px;color:#8fa0b7;font-size:14px}@media(max-width:800px){.card,.wide{grid-column:1/-1}}
</style>
</head>
<body>
<main>
  <div class="brand">◇ GeminiScanner</div>
  <section class="hero">
    <div class="pill">Paper trading control layer staged and audited</div>
    <h1>Decision-assist trading intelligence with paper-trading readiness.</h1>
    <p class="lead">GeminiScanner now shows the paper trading path built so far: local lifecycle testing, mock buy simulation, first-tiny-order preflight, approval locks, runtime environment checks, one-shot manual broker attempt, and first SPY paper order fill confirmation. Live trading and auto trading remain disabled.</p>
  </section>
  <section class="grid">
    <div class="card"><div class="k">Local lifecycle</div><div class="v ok">Complete</div><p>Intent, ticket, simulated fill, and position snapshot are stored locally in JSONL.</p></div>
    <div class="card"><div class="k">Mock buy test</div><div class="v ok">Validated</div><p>SOFI local lifecycle and SPY first-tiny paper order preflight path were exercised safely.</p></div>
    <div class="card"><div class="k">Broker execution</div><div class="v ok">Filled</div><p>First one-share SPY Alpaca paper order filled at 749.19. Further attempts are blocked by the no-retry guard.</p></div>
    <div class="card wide"><div class="k">What is ready</div><ul><li>Paper trade readiness report and lifecycle dashboards.</li><li>Order ticket sizing, simulated fill, and position state stores.</li><li>First tiny order approval, final submit unlock preview, dry-run shell, wrapper envelope, and executor shell.</li><li>Runtime environment preflight confirms paper URL, route, API key, and secret presence when env mapping is loaded.</li><li>Final runbook produced the exact one-shot manual paper broker attempt sequence.</li><li>Read-only broker status check confirmed SPY buy 1 share filled at 749.19.</li></ul></div>
    <div class="card"><div class="k">Safety state</div><ul><li>Paper order submitted: true</li><li>Paper broker contact attempted: true</li><li>Live trading: disabled</li><li>Auto trading: disabled</li><li>Account mutation: disabled</li></ul></div>
    <div class="card full"><div class="k">Diagnostics</div><div class="links"><a href="/diagnostics/paper-trade-readiness-report">Paper trade readiness report</a><a href="/diagnostics/paper-trading-final-go-no-go">Final paper go/no-go</a><a href="/diagnostics/first-real-paper-order-test-gate">First real paper order gate</a><a href="/diagnostics/paper-broker-adapter-approval-lock">Broker adapter approval lock</a><a href="/diagnostics/paper-trade-intent-creation-store">Intent store</a><a href="/diagnostics/paper-trade-order-ticket-store">Order ticket store</a><a href="/diagnostics/paper-trade-fill-simulation-store">Fill simulation store</a><a href="/diagnostics/paper-trade-position-state-store">Position state store</a></div></div>
  </section>
  <footer><strong>GeminiScanner</strong><br>Operator-controlled. Paper-only readiness staged. No automatic execution.</footer>
</main>
</body>
</html>`);
});


function appRouteLoadSourceReportRequested(req) {
  return ["1", "true", "yes", "full"].includes(
    String(req.query?.loadSources ?? req.query?.loadSourceReport ?? "").toLowerCase()
  );
}

function fastReadonlyAppPanel(title, status = "fast_preview_readonly") {
  const now = new Date().toISOString();
  return {
    ok: true,
    version: "fast_readonly_app_route_panel_v1",
    ts: now,
    panelType: "operator_dashboard_card",
    title,
    displayState: "FAST_PREVIEW_READONLY",
    status,
    readOnly: true,
    monitorOnly: true,
    diagnosticsOnly: true,
    noExecutionControls: true,
    brokerReadAttempted: false,
    brokerContactAttempted: false,
    orderSubmitAttempted: false,
    orderSubmitted: false,
    retryAttempted: false,
    accountMutationAttempted: false,
    latestFiles: {},
    order: {},
    position: {},
    sourceOrder: {},
    pnl: { pnlAvailable: false, markSource: "source_report_not_loaded" },
    readiness: {},
    noRetryGuard: { active: true, reason: "source_report_not_loaded_fast_preview" },
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

app.get('/app/paper-order-readonly-status', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_order_readonly_status_app_screen.mjs');
    const input = appRouteLoadSourceReportRequested(req)
      ? { runsDir: 'runs' }
      : { panel: fastReadonlyAppPanel('Paper Order Read-Only Status') };
    const screen = mod.buildPaperOrderReadonlyStatusAppScreen(input);
    res.type('html').send(mod.renderPaperOrderReadonlyStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper order readonly status app screen failed');
  }
});

app.get('/diagnostics/paper-order-readonly-status-dashboard', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_order_readonly_status_dashboard_panel.mjs');
    res.json(mod.buildPaperOrderReadonlyStatusDashboardPanel({ runsDir: 'runs' }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper order readonly status dashboard failed' });
  }
});

app.get('/diagnostics/paper-order-readonly-status-dashboard-panel', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_order_readonly_status_dashboard_panel.mjs');
    const report = mod.buildPaperOrderReadonlyStatusDashboardPanel({ runsDir: 'runs' });
    res.type('html').send(mod.renderPaperOrderReadonlyStatusDashboardPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper order readonly status dashboard panel failed');
  }
});


app.get('/app/paper-position-readonly-dashboard', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_position_readonly_dashboard_app_screen.mjs');
    const input = appRouteLoadSourceReportRequested(req)
      ? { runsDir: 'runs' }
      : { panel: fastReadonlyAppPanel('Paper Position Read-Only Dashboard') };
    const screen = mod.buildPaperPositionReadonlyDashboardAppScreen(input);
    res.type('html').send(mod.renderPaperPositionReadonlyDashboardAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper position read-only dashboard app screen failed');
  }
});

app.get('/diagnostics/paper-position-readonly-dashboard', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_position_readonly_dashboard_panel.mjs');
    res.json(mod.buildPaperPositionReadOnlyDashboardPanel({ runsDir: 'runs' }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper position readonly dashboard failed' });
  }
});

app.get('/diagnostics/paper-position-readonly-dashboard-panel', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_position_readonly_dashboard_panel.mjs');
    const report = mod.buildPaperPositionReadOnlyDashboardPanel({ runsDir: 'runs' });
    res.type('html').send(mod.renderPaperPositionReadOnlyDashboardPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper position readonly dashboard panel failed');
  }
});



app.get('/app/paper-position-pnl-readonly-baseline', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_position_pnl_readonly_baseline_app_screen.mjs');
    const markRaw = req.query?.markPrice ?? req.query?.mark ?? null;
    const markPrice = markRaw === null || markRaw === undefined || markRaw === '' ? null : Number(markRaw);
    const input = appRouteLoadSourceReportRequested(req)
      ? { runsDir: 'runs', markPrice }
      : { panel: fastReadonlyAppPanel('Paper Position P/L Read-Only Baseline'), markPrice };
    const screen = mod.buildPaperPositionPnlReadOnlyBaselineAppScreen(input);
    res.type('html').send(mod.renderPaperPositionPnlReadOnlyBaselineAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper position pnl read-only baseline app screen failed');
  }
});

app.get('/diagnostics/paper-position-pnl-readonly-baseline', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_position_pnl_readonly_baseline_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper position pnl readonly baseline failed' });
  }
});

app.get('/diagnostics/paper-position-pnl-readonly-baseline-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_position_pnl_readonly_baseline_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperPositionPnlReadOnlyBaselinePanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperPositionPnlReadOnlyBaselinePanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper position pnl readonly baseline panel failed');
  }
});



app.get('/app/paper-trade-lifecycle-runner-audit', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_lifecycle_runner_audit_app_screen.mjs');
    const screen = mod.buildPaperTradeLifecycleRunnerAuditAppScreen();
    res.type('html').send(mod.renderPaperTradeLifecycleRunnerAuditAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_lifecycle_runner_audit_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-trade-lifecycle-runner', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_lifecycle_runner_app_screen.mjs');
    const screen = mod.buildPaperTradeLifecycleRunnerAppScreen();
    res.type('html').send(mod.renderPaperTradeLifecycleRunnerAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_lifecycle_runner_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-trade-lifecycle-dashboard', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_lifecycle_dashboard_app_screen.mjs');
    const screen = mod.buildPaperTradeLifecycleDashboardAppScreen();
    res.type('html').send(mod.renderPaperTradeLifecycleDashboardAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_lifecycle_dashboard_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-lifecycle-dashboard', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_readonly_dashboard_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = appRouteLoadSourceReportRequested(req)
      ? mod.buildPaperLifecycleReadOnlyDashboardPanel({ runsDir: 'runs', markPrice })
      : fastReadonlyAppPanel('Paper Lifecycle Read-Only Dashboard');
    res.type('html').send(mod.renderPaperLifecycleReadOnlyDashboardPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle dashboard app screen failed');
  }
});

app.get('/diagnostics/paper-lifecycle-readonly-dashboard', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_readonly_dashboard_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleReadonlyDashboardPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle readonly dashboard failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-readonly-dashboard-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_readonly_dashboard_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleReadonlyDashboardPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleReadonlyDashboardPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle readonly dashboard panel failed');
  }
});



function renderFastLifecyclePreviewHtml(title) {
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[c]));
  return [
    "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
    "<meta name='viewport' content='width=device-width,initial-scale=1'>",
    "<title>", safe(title), "</title></head><body><main>",
    "<p><a href='/app'>Back to App Navigation</a></p>",
    "<h1>", safe(title), "</h1>",
    "<p>Fast read-only app preview. Source report not loaded unless requested.</p>",
    "<section><h2>Related Broker Readiness Routes</h2><ul>",
    "<li><a href='/app/paper-app-broker-readiness-index'>Paper App Broker Readiness Index</a></li>",
    "<li><a href='/app/paper-broker-adapter-approval-lock'>Paper Broker Adapter Approval Lock</a></li>",
    "<li><a href='/app/paper-broker-runtime-environment-preflight'>Paper Broker Runtime Environment Preflight</a></li>",
    "<li><a href='/app/paper-broker-network-attempt-status'>Paper Broker Network Attempt Status</a></li>",
    "<li><a href='/app/paper-trade-readiness-report'>Paper Trade Readiness Report</a></li>",
    "<li><a href='/app/paper-trade-broker-integration-preflight-stack'>Paper Trade Broker Integration Preflight Stack</a></li>",
    "<li><a href='/app/paper-app-safety-lock-status'>Paper App Safety Lock Status</a></li>",
    "<li><a href='/app/paper-trade-broker-adapter-guard'>Paper Trade Broker Adapter Guard</a></li>",
    "<li><a href='/app/paper-trade-execution-control-stack'>Paper Trade Execution Control Stack</a></li>",
    "<li><a href='/app/paper-trade-operator-go-no-go'>Paper Trade Operator Go / No-Go</a></li>",
    "<li><a href='/app/paper-lifecycle-dashboard'>Paper Lifecycle Read-Only Dashboard</a></li>",
    "</ul></section>",
    "<section><h2>Display State</h2><p>FAST_PREVIEW_READONLY</p>",
    "<p>Read-only, monitor-only, diagnostics-only. No broker contact, no order submit, no retry, no account mutation, no execution controls.</p></section>",
    "<section><h2>Source Report</h2><p>Add <code>?loadSources=true</code> to load the full read-only diagnostic source.</p></section>",
    "<section><h2>Safety Locks</h2><ul>",
    "<li>Read only: true</li><li>Live trading allowed: false</li><li>Auto trading allowed: false</li>",
    "<li>Order submit allowed: false</li><li>Retry allowed: false</li><li>Account mutation allowed: false</li>",
    "</ul></section></main></body></html>"
  ].join("");
}

app.get('/app/paper-lifecycle-operator-summary', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Summary Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_summary_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorSummaryReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator summary app screen failed');
  }
});

app.get('/diagnostics/paper-lifecycle-operator-summary-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_summary_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator summary readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-summary-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_summary_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorSummaryReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorSummaryReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator summary readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-operator-review-checklist-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator review checklist readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-review-checklist-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorReviewChecklistReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator review checklist readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-operator-review-packet-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator review packet readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-review-packet-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorReviewPacketReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator review packet readonly panel failed');
  }
});


app.get('/app/paper-lifecycle-final-status', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Final Status Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_final_status_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleFinalStatusReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle final status app screen failed');
  }
});

app.get('/diagnostics/paper-lifecycle-final-status-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_final_status_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle final status readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-final-status-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_final_status_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleFinalStatusReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle final status readonly panel failed');
  }
});


app.get('/app/paper-lifecycle-route-registry', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Route Registry Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_route_registry_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleRouteRegistryReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle route registry app screen failed');
  }
});

app.get('/app/paper-lifecycle-evidence-index', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Evidence Index Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_evidence_index_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleEvidenceIndexReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle evidence index app screen failed');
  }
});

app.get('/app/paper-lifecycle-evidence-bundle', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Evidence Bundle Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleEvidenceBundleReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle evidence bundle app screen failed');
  }
});


// Paper app lifecycle diagnostic aliases.
// Read-only JSON/panel mirrors for app screens already backed by server routes.
const PAPER_APP_LIFECYCLE_DIAGNOSTIC_ALIASES = Object.freeze([
  { route: '/diagnostics/paper-lifecycle-completion-seal', module: './scanner/paper_lifecycle_completion_seal_readonly_panel.mjs', build: 'buildPaperLifecycleCompletionSealReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-dashboard', module: './scanner/paper_lifecycle_readonly_dashboard_panel.mjs', build: 'buildPaperLifecycleReadOnlyDashboardPanel' },
  { route: '/diagnostics/paper-lifecycle-evidence-bundle', module: './scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs', build: 'buildPaperLifecycleEvidenceBundleReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-evidence-index', module: './scanner/paper_lifecycle_evidence_index_readonly_panel.mjs', build: 'buildPaperLifecycleEvidenceIndexReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-final-status', module: './scanner/paper_lifecycle_final_status_readonly_panel.mjs', build: 'buildPaperLifecycleFinalStatusReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-handoff', module: './scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorHandoffReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-handoff-packet', module: './scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-handoff-packet-digest', module: './scanner/paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal', module: './scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-review-checklist', module: './scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-review-packet', module: './scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorReviewPacketReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-operator-summary', module: './scanner/paper_lifecycle_operator_summary_readonly_panel.mjs', build: 'buildPaperLifecycleOperatorSummaryReadOnlyPanel' },
  { route: '/diagnostics/paper-lifecycle-route-registry', module: './scanner/paper_lifecycle_route_registry_readonly_panel.mjs', build: 'buildPaperLifecycleRouteRegistryReadOnlyPanel' }
]);

function summarizePaperAppDiagnosticAliasPayload(payload = {}, route = '') {
  return {
    ok: payload.ok ?? true,
    route,
    version: payload.version ?? null,
    title: payload.title ?? null,
    status: payload.status ?? null,
    displayState: payload.displayState ?? null,
    readOnly: payload.readOnly ?? true,
    monitorOnly: payload.monitorOnly ?? true,
    diagnosticsOnly: true,
    noExecutionControls: payload.noExecutionControls ?? true,
    noOrderPlacement: payload.noOrderPlacement ?? true,
    brokerExecutionAllowed: payload.brokerExecutionAllowed ?? false,
    orderPlacementAllowed: payload.orderPlacementAllowed ?? false,
    safety: payload.safety ?? null,
    summary: payload.summary ?? null,
    ts: payload.ts ?? new Date().toISOString()
  };
}

for (const spec of PAPER_APP_LIFECYCLE_DIAGNOSTIC_ALIASES) {
  app.get(spec.route, async (_req, res) => {
    try {
      const mod = await import(spec.module);
      const payload = mod[spec.build]();
      res.json(payload);
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route, error: 'paper_app_lifecycle_diagnostic_alias_failed', message: err?.message ?? String(err) });
    }
  });

  app.get(spec.route + '-panel', async (_req, res) => {
    try {
      const mod = await import(spec.module);
      const payload = mod[spec.build]();
      res.json(summarizePaperAppDiagnosticAliasPayload(payload, spec.route + '-panel'));
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route + '-panel', error: 'paper_app_lifecycle_diagnostic_alias_panel_failed', message: err?.message ?? String(err) });
    }
  });
}


app.get('/app/paper-lifecycle-completion-seal', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Completion Seal Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_completion_seal_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleCompletionSealReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle completion seal app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-review-checklist', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Review Checklist Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_review_checklist_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorReviewChecklistReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorReviewChecklistReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator review checklist app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-review-packet', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Review Packet Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_review_packet_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorReviewPacketReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorReviewPacketReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator review packet app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-handoff', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Handoff Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-handoff-packet', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Handoff Packet Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff packet app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-handoff-packet-digest', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Handoff Packet Digest Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff packet digest app screen failed');
  }
});

app.get('/app/paper-lifecycle-operator-handoff-packet-digest-seal', async (req, res) => {
  try {
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Lifecycle Operator Handoff Packet Digest Seal Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs');
    const report = mod.buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff packet digest seal app screen failed');
  }
});


app.get('/diagnostics/paper-lifecycle-route-registry-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_route_registry_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle route registry readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-route-registry-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_route_registry_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleRouteRegistryReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleRouteRegistryReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle route registry readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-evidence-index-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_evidence_index_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle evidence index readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-evidence-index-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_evidence_index_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleEvidenceIndexReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleEvidenceIndexReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle evidence index readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-evidence-bundle-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle evidence bundle readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-evidence-bundle-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_evidence_bundle_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleEvidenceBundleReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleEvidenceBundleReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle evidence bundle readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-completion-seal-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_completion_seal_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle completion seal readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-completion-seal-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_completion_seal_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleCompletionSealReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleCompletionSealReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle completion seal readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-operator-handoff-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator handoff readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-handoff-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorHandoffReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator handoff packet readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorHandoffPacketReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff packet readonly panel failed');
  }
});


app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-digest-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({ runsDir: 'runs', markPrice: mark }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle operator handoff packet digest readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-digest-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_readonly_panel.mjs');
    const mark = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel({ runsDir: 'runs', markPrice: mark });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketDigestReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle operator handoff packet digest readonly panel failed');
  }
});

app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({ runsDir: 'runs', markPrice }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper lifecycle digest seal readonly failed' });
  }
});

app.get('/diagnostics/paper-lifecycle-operator-handoff-packet-digest-seal-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_lifecycle_operator_handoff_packet_digest_seal_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperLifecycleOperatorHandoffPacketDigestSealReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper lifecycle digest seal readonly panel failed');
  }
});

app.get('/diagnostics/paper-trading-completion-certificate-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_completion_certificate_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperTradingCompletionCertificateReadOnlyPanel({ runsDir: 'runs', markPrice }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper trading completion certificate readonly failed' });
  }
});

app.get('/app/paper-trading-completion-certificate', async (req, res) => {
  try {
    if (!appRouteLoadSourceReportRequested(req)) {
      res.type('html').send(renderFastLifecyclePreviewHtml('Paper Trading Completion Certificate Read-Only'));
      return;
    }
    const mod = await import('./scanner/paper_trading_completion_certificate_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperTradingCompletionCertificateReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperTradingCompletionCertificateReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading completion certificate app screen failed');
  }
});

app.get('/diagnostics/paper-trading-completion-certificate-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_completion_certificate_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperTradingCompletionCertificateReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperTradingCompletionCertificateReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading completion certificate readonly panel failed');
  }
});

app.get('/diagnostics/paper-trading-module-route-index-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_route_index_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperTradingModuleRouteIndexReadOnlyPanel({ runsDir: 'runs', markPrice }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper trading module route index readonly failed' });
  }
});

app.get('/app/paper-trading-module-route-index', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_route_index_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = appRouteLoadSourceReportRequested(req)
      ? mod.buildPaperTradingModuleRouteIndexReadOnlyPanel({ runsDir: 'runs', markPrice })
      : {
          ...fastReadonlyAppPanel('Paper Trading Module Route Index Read-Only'),
          paperTradingModuleRouteIndex: { routes: [], routeCount: 0, routeIndexStatus: 'fast_preview_readonly' }
        };
    res.type('html').send(mod.renderPaperTradingModuleRouteIndexReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading module route index app screen failed');
  }
});

app.get('/diagnostics/paper-trading-module-route-index-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_route_index_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperTradingModuleRouteIndexReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperTradingModuleRouteIndexReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading module route index readonly panel failed');
  }
});

app.get('/diagnostics/paper-trading-module-final-status-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_final_status_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    res.json(mod.buildPaperTradingModuleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err?.message ?? 'paper trading module final status readonly failed' });
  }
});

app.get('/app/paper-trading-module-final-status', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_final_status_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = appRouteLoadSourceReportRequested(req)
      ? mod.buildPaperTradingModuleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice })
      : {
          ...fastReadonlyAppPanel('Paper Trading Module Final Status Read-Only'),
          paperTradingModuleFinalStatus: { milestones: [], finalStatus: 'fast_preview_readonly' }
        };
    res.type('html').send(mod.renderPaperTradingModuleFinalStatusReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading module final status app screen failed');
  }
});

app.get('/diagnostics/paper-trading-module-final-status-readonly-panel', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_module_final_status_readonly_panel.mjs');
    const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
    const report = mod.buildPaperTradingModuleFinalStatusReadOnlyPanel({ runsDir: 'runs', markPrice });
    res.type('html').send(mod.renderPaperTradingModuleFinalStatusReadOnlyPanel(report));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trading module final status readonly panel failed');
  }
});

app.get('/health', health);
app.get('/readiness', readiness);
app.get('/diagnostics', getDiagnostics);
app.get('/diagnostics/alpaca-api-watch', (req, res) => {
  const reportFile = "runs/alpaca_api_watch_report.json";
  try {
    const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
    res.json({ ok: true, report });
  } catch (err) {
    res.json({ ok: false, error: "WATCH_REPORT_UNAVAILABLE", message: err?.message || String(err) });
  }
});

app.get('/diagnostics/alpaca-requests', (req, res) => {
  res.json({
    ok: true,
    alpacaRequestAudit: getAlpacaRequestAudit(),
  });
});
app.get('/marketdata', marketDataDump);


app.get('/scanner/stage2-app', async (_req, res) => {
  try {
    const rankings = await readScannerRankings()
    res.json({
      ok: true,
      endpointVersion: 'scanner_stage2_app_v1',
      ts: rankings.ts,
      scannerHealth: rankings.scannerHealth,
      rankingConfidence: rankings.rankingConfidence,
      stage2FinalCommand: rankings.stage2FinalCommand,
      stage2FinalPermission: rankings.stage2FinalPermission,
      stage2AppDisplay: rankings.stage2AppDisplay,
      stage2MobileDecisionCard: rankings.stage2MobileDecisionCard,
      stage2AppScreenPayload: rankings.stage2AppScreenPayload
    })
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'SCANNER_STAGE2_APP_FAILED',
      message: err && err.message ? err.message : String(err)
    })
  }
})

app.get('/scanner/rankings', (req, res) => {
  try {
    res.json({
      ...readScannerRankings(),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Runlog endpoints
app.get('/runlog', runlogIndex);
app.get('/runlog/:id', (req, res) => {
  const runId = req.params.id;
  if (!runId) return res.status(400).json({ ok: false, error: 'Missing runId' });

  const runData = readRun(runId);
  if (!runData) return res.status(404).json({ ok: false, error: 'Run not found' });

  res.json({ ok: true, runId, runData, ts: new Date().toISOString() });
});

// --------------------
// /api/next-step endpoint
// --------------------
app.get('/api/next-step', (req, res) => {
  const symbol = req.query.symbol || 'AAPL';
  const decision = nextStep(symbol);

  const coaching = getCoaching({
    symbol,
    decision,
    snapshot: null,
    ctx: { rules: { lcmEnabled: true } },
  });

  res.json({ ...decision, coaching });
});

// --------------------
// /coach endpoint
// --------------------
app.post('/coach', async (req, res) => {
  try {
    const { symbol, snapshot, decision, rules } = req.body || {};
    if (!symbol) return res.status(400).json({ ok: false, error: 'Missing symbol' });

    const snap = snapshot || buildLiveSnapshot(symbol, {});
    const dec = decision || { symbol, action: 'hold' };
    const ctxRules = rules || { lcmEnabled: true };

    const out = getCoaching({
      symbol,
      snapshot: snap,
      decision: dec,
      ctx: { rules: ctxRules },
    });

    const stage2Payload = await buildStage2LcmPayload();

    res.json(attachStage2ToCoachingOutput(out, stage2Payload));
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --------------------
// /ops/run endpoint
// --------------------
app.post('/ops/run', async (req, res) => {
  try {
    const inputs = req.body || {};
    const decision = inputs.decision;
    const symbol = decision?.symbol;
    const action = decision?.action;

    if (!decision || !symbol || !action) {
      return res.status(400).json({ ok: false, error: 'Missing decision (symbol/action)' });
    }

    const snapshot = buildLiveSnapshot(symbol, {});
    const coaching = getCoaching({
      symbol,
      decision,
      snapshot,
      ctx: { rules: { lcmEnabled: true } },
    });

    const stage2Payload = await buildStage2LcmPayload();

    // -------- Pillar 3 Compute-Only (Guarded) --------
    let context_v3 = null;
    let p3_gate = { ok: true };

    if (P3_ENABLED) {
      const nowMs = Date.now();
      const session = snapshot?.session || 'unknown';

      const barsByTf = buildBarsByTfFrom1m(snapshot?.bars || []);

      // Compute lastBar + ageSec (prefer snapshot.bar.t, else last bars[] entry)
      const lastBarIso =
        snapshot?.bar?.t ||
        (Array.isArray(snapshot?.bars) && snapshot.bars.length
          ? snapshot.bars[snapshot.bars.length - 1]?.t
          : null);

      const lastBarMs = lastBarIso ? Date.parse(lastBarIso) : NaN;
      const ageSec = Number.isFinite(lastBarMs) ? Math.floor((nowMs - lastBarMs) / 1000) : null;

      // Lookback sufficiency thresholds (tuneable later)
      const minLookback = { '1m': 60, '5m': 60, '15m': 40, '1h': 30 };
      const lookbackHave = Object.fromEntries(
        Object.entries(minLookback).map(([tf]) => [tf, Array.isArray(barsByTf?.[tf]) ? barsByTf[tf].length : 0])
      );

      const insufficientLookback = Object.entries(minLookback).some(([tf, min]) => (lookbackHave[tf] || 0) < min);

      // Freshness gate: strict only during confirmed regular session; relaxed otherwise for off-hours/historical validation.
      const maxFreshSecRegular = Number(process.env.P3_MAX_FRESH_SEC_REGULAR || 600);      // 10 min
      const maxFreshSecClosed  = Number(process.env.P3_MAX_FRESH_SEC_CLOSED  || 604800);  // 7 days
      const isRegularSession = session === 'regular';
      const maxFreshSec = isRegularSession ? maxFreshSecRegular : maxFreshSecClosed;

      const staleHard = (ageSec === null)
        ? true
        : (isRegularSession ? (ageSec > maxFreshSec) : false);

      if (staleHard || insufficientLookback) {
        p3_gate = {
          ok: false,
          reason: staleHard ? 'STALE_SNAPSHOT' : 'INSUFFICIENT_LOOKBACK',
          session,
          lastBar: lastBarIso,
          ageSec,
          maxFreshSec,
          minLookback,
          lookbackHave,
        };
        context_v3 = null; // hard skip
      } else {
        context_v3 = computeContextV3({
          symbol,
          barsByTf,
          nowMs,
          session,
          provider: "live_snapshot",
        }, {
          telemetry: getStreamTelemetry({ nowMs }),
        });
        p3_gate = { ok: true, session, lastBar: lastBarIso, ageSec, minLookback, lookbackHave };
      }
    }

    const record = writeRunlog({
      mode: 'ops_run_dryrun',
      inputs,
      output: {
        result: decision,
        coaching,
      },
      context_v3,
      p3_gate,
    });

    const snapshotOut = {
      ...snapshot,
      barsCount: Array.isArray(snapshot?.bars) ? snapshot.bars.length : 0,
    };

    const coachingOut = {
      ...coaching,
      rsi: coaching?.debug?.rsiComputed ?? null,
      coachingCount: Array.isArray(coaching?.coaching)
        ? coaching.coaching.length
        : 0,
    };

    res.json({
      ok: true,
      stage2Lcm: stage2Payload,
      runId: record.id,
      result: decision,
      snapshot: snapshotOut,
      coaching: coachingOut,
      context_v3: P3_ENABLED ? context_v3 : undefined,
      p3_gate: P3_ENABLED ? p3_gate : undefined,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// --------------------
// Startup
// --------------------


// Paper app non-lifecycle diagnostic aliases.
// Read-only JSON/panel mirrors for app screens and short redirect aliases.
const PAPER_APP_NONLIFECYCLE_DIAGNOSTIC_ALIASES = Object.freeze([
  { route: '/diagnostics/alpaca-paper-account-status', module: './scanner/alpaca_paper_account_status_app_screen.mjs', build: 'buildAlpacaPaperAccountStatusAppScreen' },
  { route: '/diagnostics/operator-approval-dashboard', module: './scanner/operator_approval_dashboard_app_screen.mjs', build: 'buildOperatorApprovalDashboardAppScreen' },
  { route: '/diagnostics/paper-app-readiness-status', module: './scanner/paper_app_readiness_status_app_screen.mjs', build: 'buildPaperAppReadinessStatusAppScreen', args: [{}] },
  { route: '/diagnostics/paper-operator-start-here', module: './scanner/paper_operator_start_here_app_screen.mjs', build: 'buildPaperOperatorStartHereAppScreen' },
  { route: '/diagnostics/paper-order-readonly-status', module: './scanner/paper_order_readonly_status_app_screen.mjs', build: 'buildPaperOrderReadonlyStatusAppScreen', args: [{ panel: fastReadonlyAppPanel('Paper Order Read-Only Status') }] },
  { route: '/diagnostics/paper-trading-overview-status', module: './scanner/paper_trading_overview_status_app_screen.mjs', build: 'buildPaperTradingOverviewStatusAppScreen' }
]);

const PAPER_APP_NONLIFECYCLE_REDIRECT_DIAGNOSTIC_ALIASES = Object.freeze([
  { route: '/diagnostics/paper-trade-broker-integration-preflight', target: '/app/paper-trade-broker-integration-preflight-stack' },
  { route: '/diagnostics/paper-trade-readiness', target: '/app/paper-trade-readiness-report' },
  { route: '/diagnostics/paper-trading-readiness', target: '/app/paper-trade-readiness-report' }
]);

function summarizePaperAppNonLifecycleDiagnosticAliasPayload(payload = {}, route = '') {
  return {
    ok: payload.ok ?? true,
    route,
    version: payload.version ?? null,
    title: payload.title ?? null,
    status: payload.status ?? null,
    displayState: payload.displayState ?? null,
    readOnly: payload.readOnly ?? true,
    monitorOnly: payload.monitorOnly ?? true,
    diagnosticsOnly: true,
    noExecutionControls: payload.noExecutionControls ?? true,
    noOrderPlacement: payload.noOrderPlacement ?? true,
    brokerExecutionAllowed: payload.brokerExecutionAllowed ?? false,
    orderPlacementAllowed: payload.orderPlacementAllowed ?? false,
    safety: payload.safety ?? null,
    summary: payload.summary ?? null,
    ts: payload.ts ?? new Date().toISOString()
  };
}

for (const spec of PAPER_APP_NONLIFECYCLE_DIAGNOSTIC_ALIASES) {
  app.get(spec.route, async (_req, res) => {
    try {
      const mod = await import(spec.module);
      const payload = mod[spec.build](...(spec.args ?? []));
      res.json(payload);
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route, error: 'paper_app_nonlifecycle_diagnostic_alias_failed', message: err?.message ?? String(err) });
    }
  });

  app.get(spec.route + '-panel', async (_req, res) => {
    try {
      const mod = await import(spec.module);
      const payload = mod[spec.build](...(spec.args ?? []));
      res.json(summarizePaperAppNonLifecycleDiagnosticAliasPayload(payload, spec.route + '-panel'));
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route + '-panel', error: 'paper_app_nonlifecycle_diagnostic_alias_panel_failed', message: err?.message ?? String(err) });
    }
  });
}

for (const spec of PAPER_APP_NONLIFECYCLE_REDIRECT_DIAGNOSTIC_ALIASES) {
  app.get(spec.route, (_req, res) => {
    res.json({
      ok: true,
      route: spec.route,
      target: spec.target,
      status: 'paper_app_redirect_alias_readonly',
      displayState: 'PAPER_APP_REDIRECT_ALIAS_READONLY',
      readOnly: true,
      monitorOnly: true,
      diagnosticsOnly: true,
      noExecutionControls: true,
      noOrderPlacement: true,
      brokerExecutionAllowed: false,
      orderPlacementAllowed: false,
      ts: new Date().toISOString()
    });
  });

  app.get(spec.route + '-panel', (_req, res) => {
    res.json({
      ok: true,
      route: spec.route + '-panel',
      target: spec.target,
      status: 'paper_app_redirect_alias_panel_readonly',
      displayState: 'PAPER_APP_REDIRECT_ALIAS_PANEL_READONLY',
      readOnly: true,
      monitorOnly: true,
      diagnosticsOnly: true,
      noExecutionControls: true,
      noOrderPlacement: true,
      brokerExecutionAllowed: false,
      orderPlacementAllowed: false,
      ts: new Date().toISOString()
    });
  });
}


app.get('/app/alpaca-paper-account-status', (_req, res) => {
  const screen = buildAlpacaPaperAccountStatusAppScreen();
  res.type('html').send(renderAlpacaPaperAccountStatusAppScreenHtml(screen));
});


// Paper app final status diagnostic aliases.
// Read-only JSON/panel mirrors for final paper-trading status app screens.
const PAPER_APP_FINAL_STATUS_DIAGNOSTIC_ALIASES = Object.freeze([
  {
    route: '/diagnostics/paper-trading-completion-certificate',
    module: './scanner/paper_trading_completion_certificate_readonly_panel.mjs',
    build: 'buildPaperTradingCompletionCertificateReadOnlyPanel',
    render: 'renderPaperTradingCompletionCertificateReadOnlyPanel',
    title: 'Paper Trading Completion Certificate Read-Only',
    preview: { paperTradingCompletionCertificate: { certificateStatus: 'fast_preview_readonly' } }
  },
  {
    route: '/diagnostics/paper-trading-module-final-status',
    module: './scanner/paper_trading_module_final_status_readonly_panel.mjs',
    build: 'buildPaperTradingModuleFinalStatusReadOnlyPanel',
    render: 'renderPaperTradingModuleFinalStatusReadOnlyPanel',
    title: 'Paper Trading Module Final Status Read-Only',
    preview: { paperTradingModuleFinalStatus: { milestones: [], finalStatus: 'fast_preview_readonly' } }
  },
  {
    route: '/diagnostics/paper-trading-module-route-index',
    module: './scanner/paper_trading_module_route_index_readonly_panel.mjs',
    build: 'buildPaperTradingModuleRouteIndexReadOnlyPanel',
    render: 'renderPaperTradingModuleRouteIndexReadOnlyPanel',
    title: 'Paper Trading Module Route Index Read-Only',
    preview: { paperTradingModuleRouteIndex: { routes: [], routeCount: 0, routeIndexStatus: 'fast_preview_readonly' } }
  }
]);

function summarizePaperAppFinalStatusDiagnosticAliasPayload(payload = {}, route = '') {
  return {
    ok: payload.ok ?? true,
    route,
    version: payload.version ?? null,
    title: payload.title ?? null,
    status: payload.status ?? null,
    displayState: payload.displayState ?? null,
    readOnly: payload.readOnly ?? true,
    monitorOnly: payload.monitorOnly ?? true,
    diagnosticsOnly: true,
    noExecutionControls: payload.noExecutionControls ?? true,
    noOrderPlacement: payload.noOrderPlacement ?? true,
    brokerExecutionAllowed: payload.brokerExecutionAllowed ?? false,
    orderPlacementAllowed: payload.orderPlacementAllowed ?? false,
    safety: payload.safety ?? null,
    summary: payload.summary ?? null,
    ts: payload.ts ?? new Date().toISOString()
  };
}

for (const spec of PAPER_APP_FINAL_STATUS_DIAGNOSTIC_ALIASES) {
  app.get(spec.route, async (req, res) => {
    try {
      const mod = await import(spec.module);
      const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
      const report = mod[spec.build]({ runsDir: 'runs', markPrice });
      res.json(report);
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route, error: 'paper_app_final_status_diagnostic_alias_failed', message: err?.message ?? String(err) });
    }
  });

  app.get(spec.route + '-panel', async (req, res) => {
    try {
      const mod = await import(spec.module);
      const markPrice = req.query?.mark === undefined ? null : Number(req.query.mark);
      const report = mod[spec.build]({ runsDir: 'runs', markPrice });
      res.json(summarizePaperAppFinalStatusDiagnosticAliasPayload(report, spec.route + '-panel'));
    } catch (err) {
      res.status(500).json({ ok: false, route: spec.route + '-panel', error: 'paper_app_final_status_diagnostic_alias_panel_failed', message: err?.message ?? String(err) });
    }
  });
}


const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

if (!app.__geminiOperatorDashboardRoutesRegistered) {
  registerOperatorDashboardRoutes(app);
}

const requireInternalOwnerAuth = createRequireOperatorDashboardAuth();
const requireInternalOwnerAuthorization = createRequireInternalOwnerAuthorization();
const requireInternalOwnerTenantIsolation = createRequireInternalOwnerTenantIsolation();



app.get('/app/operator-approval-dashboard', async (req, res) => {
  try {
    const mod = await import('./scanner/operator_approval_dashboard_app_screen.mjs');
    const screen = mod.buildOperatorApprovalDashboardAppScreen();
    res.type('html').send(mod.renderOperatorApprovalDashboardAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'operator approval dashboard app screen failed');
  }
});


app.get('/diagnostics/operator-approval-dashboard-panel', (req, res) => {
  try {
    const panel = buildOperatorApprovalDashboardPanel();
    res.json({ ok: true, panel });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'operator_approval_dashboard_panel_failed',
      message: error?.message || String(error)
    });
  }
});
app.get('/app/operator-approval-workflow', async (req, res) => {
  try {
    const workflowMod = await import('./scanner/operator_approval_workflow.mjs');
    const appMod = await import('./scanner/operator_approval_workflow_app_screen.mjs');
    const workflow = await workflowMod.loadOperatorApprovalWorkflow();
    const screen = appMod.buildOperatorApprovalWorkflowAppScreen({ workflow });
    res.type('html').send(appMod.renderOperatorApprovalWorkflowAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'operator approval workflow app screen failed');
  }
});

app.get('/diagnostics/operator-approval-workflow', async (req, res) => {
  try {
    const { loadOperatorApprovalWorkflow } = await import('./scanner/operator_approval_workflow.mjs')
    const workflow = await loadOperatorApprovalWorkflow()
    res.json(workflow)
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'operator_approval_workflow_failed',
      message: error instanceof Error ? error.message : String(error)
    })
  }
})



app.get("/diagnostics/paper-readiness-gate-app-screen", (req, res) => {
  res.json(buildPaperReadinessGateAppScreen({
    baseDir: process.cwd(),
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  }));
});

app.get("/app/paper-readiness-gate", (req, res) => {
  const screen = buildPaperReadinessGateAppScreen({
    baseDir: process.cwd(),
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  });
  res.type("html").send(renderPaperReadinessGateAppScreenHtml(screen));
});

app.get("/diagnostics/paper-trading-readiness-gate", (_req, res) => {
  try {
    const result = getPaperTradingReadinessGate({ baseDir: process.cwd() });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      version: "paper-trading-readiness-gate-v1",
      error: err?.message || String(err),
      monitorOnly: true,
      allowedToCreatePaperIntent: false,
      paperIntentStatus: "blocked"
    });
  }
});




app.get("/diagnostics/paper-trade-intent-plan-app-screen", (req, res) => {
  res.json(buildPaperTradeIntentPlanAppScreen({
    baseDir: process.cwd(),
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  }));
});

app.get("/app/paper-trade-intent-plan", (req, res) => {
  const screen = buildPaperTradeIntentPlanAppScreen({
    baseDir: process.cwd(),
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  });
  res.type("html").send(renderPaperTradeIntentPlanAppScreenHtml(screen));
});

app.get("/diagnostics/paper-trade-intent-plan", (_req, res) => {
  try {
    const result = getPaperTradeIntentPlan({ baseDir: process.cwd() });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      version: "paper-trade-intent-planner-v1",
      error: err?.message || String(err),
      monitorOnly: true,
      brokerContacted: false,
      orderPlacement: "disabled",
      accountMutation: "disabled",
      canCreateIntent: false,
      paperTradeIntentStatus: "blocked",
      intent: null
    });
  }
});



app.get('/diagnostics/paper-trade-intent-dashboard-panel', (_req, res) => {
  try {
    res.json(buildPaperTradeIntentDashboardPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      monitorOnly: true,
      route: '/diagnostics/paper-trade-intent-dashboard-panel',
      error: error?.message ?? String(error)
    });
  }
});


app.get('/diagnostics/paper-broker-null-adapter', (req, res) => {
  try {
    res.json(getPaperBrokerNullAdapterDiagnostics({
      symbol: req.query.symbol,
      side: req.query.side,
      qty: req.query.qty,
      notional: req.query.notional,
      orderType: req.query.orderType,
      timeInForce: req.query.timeInForce
    }));
  } catch (error) {
    res.status(500).json({
      ok: false,
      route: '/diagnostics/paper-broker-null-adapter',
      error: error?.message ?? String(error)
    });
  }
});


app.get('/diagnostics/paper-broker-adapter-contract', (req, res) => {
  try {
    res.json(getPaperBrokerAdapterContractDiagnostics({
      symbol: req.query.symbol,
      side: req.query.side,
      qty: req.query.qty,
      notional: req.query.notional,
      orderType: req.query.orderType,
      timeInForce: req.query.timeInForce,
      auditId: req.query.auditId
    }));
  } catch (error) {
    res.status(500).json({
      ok: false,
      route: '/diagnostics/paper-broker-adapter-contract',
      error: error?.message ?? String(error)
    });
  }
});


app.get('/diagnostics/paper-order-intent-adapter-preview-bridge', async (req, res) => {
  try {
    res.json(await getPaperOrderIntentAdapterPreviewBridgeDiagnostics({
      symbol: req.query.symbol,
      side: req.query.side,
      qty: req.query.qty,
      notional: req.query.notional,
      orderType: req.query.orderType,
      timeInForce: req.query.timeInForce,
      auditId: req.query.auditId
    }));
  } catch (error) {
    res.status(500).json({
      ok: false,
      route: '/diagnostics/paper-order-intent-adapter-preview-bridge',
      error: error?.message ?? String(error)
    });
  }
});



app.get('/app/paper-operator-start-here', (_req, res) => {
  try {
    const screen = buildPaperOperatorStartHereAppScreen();
    res.type('html').send(renderPaperOperatorStartHereAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, route: '/app/paper-operator-start-here', error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/app/paper-broker-adapter-approval-record-tool', async (req, res) => {
  try {
    const screen = await buildPaperBrokerAdapterApprovalRecordToolAppScreen();
    res.type('html').send(renderPaperBrokerAdapterApprovalRecordToolAppScreenHtml(screen));
  } catch (error) {
    res.status(500).type('text').send(error?.message ?? String(error));
  }
});

app.get('/diagnostics/paper-broker-adapter-approval-record-tool', async (req, res) => {
  try {
    res.json(await getPaperBrokerAdapterApprovalRecordDiagnostics());
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-broker-adapter-approval-record-tool', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/alpaca-paper-broker-adapter', async (req, res) => {
  try {
    res.json(await getAlpacaPaperBrokerAdapterDiagnostics({
      symbol: req.query.symbol,
      side: req.query.side,
      qty: req.query.qty,
      notional: req.query.notional,
      orderType: req.query.orderType,
      timeInForce: req.query.timeInForce
    }));
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/alpaca-paper-broker-adapter', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/paper-order-submit-dry-run', async (req, res) => {
  try {
    res.json(await getPaperOrderSubmitDryRunDiagnostics({
      symbol: req.query.symbol,
      side: req.query.side,
      qty: req.query.qty,
      notional: req.query.notional,
      orderType: req.query.orderType,
      timeInForce: req.query.timeInForce,
      marketSession: req.query.marketSession
    }));
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-order-submit-dry-run', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/paper-trading-final-go-no-go', async (req, res) => {
  try {
    res.json(await getPaperTradingFinalGoNoGoDiagnostics());
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-trading-final-go-no-go', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/first-real-paper-order-test-gate', async (req, res) => {
  try {
    res.json(await getFirstRealPaperOrderTestGateDiagnostics());
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/first-real-paper-order-test-gate', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/paper-trading-monitoring-kill-switch', async (req, res) => {
  try {
    res.json(await getPaperTradingMonitoringDiagnostics());
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-trading-monitoring-kill-switch', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/real-trading-conversion-lock', (req, res) => {
  try {
    res.json(getRealTradingConversionLockDiagnostics());
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/real-trading-conversion-lock', error: error?.message ?? String(error) });
  }
});





app.get("/diagnostics/paper-attempt-control-center-app-screen", (req, res) => {
  res.json(buildPaperAttemptControlCenterAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  }));
});

app.get("/app/paper-attempt-control-center", (req, res) => {
  const screen = buildPaperAttemptControlCenterAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  });
  res.type("html").send(renderPaperAttemptControlCenterAppScreenHtml(screen));
});

app.get("/diagnostics/paper-attempt-control-center-panel", (_req, res) => {
  res.json(buildPaperAttemptControlCenterPanel());
});


app.get("/diagnostics/paper-attempt-control-center-panel.html", (req, res) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/app/paper-attempt-control-center${query}`);
});



app.get("/diagnostics/paper-attempt-control-center", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(buildPaperAttemptControlCenter());
});


// Paper Attempt Operator Review Packet Panel v1 - review-only diagnostics

app.get("/diagnostics/paper-attempt-operator-review-packet-app-screen", (req, res) => {
  res.json(buildPaperAttemptOperatorReviewPacketAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  }));
});

app.get("/app/operator-review-packet", (req, res) => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  });
  res.type("html").send(renderPaperAttemptOperatorReviewPacketAppScreenHtml(screen));
});

app.get("/app/first-tiny-manual-paper-attempt-review-packet", (req, res) => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
    title: "First Tiny Manual Paper Attempt Review Packet",
    subtitle: "Read-only first tiny manual paper attempt review packet. No broker contact and no order placement. No execution controls. No account mutation."
  });
  res.type("html").send(renderPaperAttemptOperatorReviewPacketAppScreenHtml(screen));
});

app.get("/diagnostics/paper-attempt-operator-review-packet-panel", (req, res) => {
  res.json(buildPaperAttemptOperatorReviewPacketPanel());
});

app.get("/diagnostics/paper-attempt-operator-review-packet-panel-view", (_req, res) => {
  res.redirect(302, "/app/operator-review-packet");
});


app.get("/diagnostics/paper-attempt-operator-review-packet-audit", async (req, res) => {
  try {
    const mod = await import("./scanner/paper_attempt_operator_review_packet_audit.mjs");
    const result = mod.buildPaperAttemptOperatorReviewPacketAudit({ persist: false });
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_operator_review_packet_audit_v1",
      error: error?.message || String(error),
    });
  }
});

app.get("/diagnostics/paper-attempt-operator-review-packet-audit-view", (_req, res) => {
  res.redirect(302, "/app/operator-review-packet");
});



app.get("/diagnostics/paper-attempt-operator-review-packet-audit-panel", async (req, res) => {
  try {
    const mod = await import("./scanner/paper_attempt_operator_review_packet_audit_panel.mjs");
    const result = mod.buildPaperAttemptOperatorReviewPacketAuditPanel();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_operator_review_packet_audit_panel_v1",
      error: error?.message || String(error),
    });
  }
});

app.get("/diagnostics/paper-attempt-operator-review-packet-audit-panel-view", (_req, res) => {
  res.redirect(302, "/app/operator-review-packet");
});




app.get("/diagnostics/paper-attempt-operator-review-packet-audit-dashboard-app-screen", (req, res) => {
  res.json(buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen({
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  }));
});

app.get("/app/audit-dashboard", (req, res) => {
  const screen = buildPaperAttemptOperatorReviewPacketAuditDashboardAppScreen({
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  });
  res.type("html").send(renderPaperAttemptOperatorReviewPacketAuditDashboardAppScreenHtml(screen));
});

app.get("/diagnostics/paper-attempt-operator-review-packet-audit-dashboard", async (req, res) => {
  try {
    const mod = await import("./scanner/paper_attempt_operator_review_packet_audit_dashboard.mjs");
    const result = mod.buildPaperAttemptOperatorReviewPacketAuditDashboard();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_operator_review_packet_audit_dashboard_v1",
      error: error?.message || String(error),
    });
  }
});

app.get("/diagnostics/paper-attempt-operator-review-packet-audit-dashboard-view", (_req, res) => {
  res.redirect(302, "/app/audit-dashboard");
});



app.get("/diagnostics/paper-attempt-operator-review-packet-audit-dashboard-panel", async (req, res) => {
  try {
    const mod = await import("./scanner/paper_attempt_operator_review_packet_audit_dashboard_panel.mjs");
    const result = mod.buildPaperAttemptOperatorReviewPacketAuditDashboardPanel();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_operator_review_packet_audit_dashboard_panel_v1",
      error: error?.message || String(error),
    });
  }
});

app.get("/diagnostics/paper-attempt-operator-review-packet-audit-dashboard-panel-view", (_req, res) => {
  res.redirect(302, "/app/audit-dashboard");
});




app.get("/diagnostics/paper-attempt-module-complete-selector-app-screen", (req, res) => {
  res.json(buildPaperAttemptModuleCompleteSelectorAppScreen({
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  }));
});

app.get("/app/module-complete-selector", (req, res) => {
  const screen = buildPaperAttemptModuleCompleteSelectorAppScreen({
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date()
  });
  res.type("html").send(renderPaperAttemptModuleCompleteSelectorAppScreenHtml(screen));
});

app.get("/diagnostics/paper-attempt-module-complete-selector-panel", async (_req, res) => {
  try {
    const mod = await import("./scanner/paper_attempt_module_complete_selector_panel.mjs");
    res.json(mod.buildPaperAttemptModuleCompleteSelectorPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_module_complete_selector_panel_v1",
      error: error?.message || String(error),
    });
  }
});

app.get("/diagnostics/paper-attempt-module-complete-selector-panel-view", (_req, res) => {
  res.redirect(302, "/app/module-complete-selector");
});


app.get("/diagnostics/paper-attempt-read-only-planning-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyPlanningDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_planning_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyPlanningDiagnosticPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_planning_diagnostic_panel_v1",
      error: error?.message ?? String(error),
    });
  }
});


app.get("/diagnostics/paper-attempt-read-only-go-no-go-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_go_no_go_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyGoNoGoDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-go-no-go-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});



app.get("/diagnostics/paper-attempt-read-only-approval-record-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_approval_record_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyApprovalRecordDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-approval-record-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});



app.get("/diagnostics/paper-attempt-read-only-execution-authorization-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_execution_authorization_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyExecutionAuthorizationDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-execution-authorization-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});



app.get("/diagnostics/paper-attempt-read-only-broker-execution-path-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyBrokerExecutionPathDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_broker_execution_path_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyBrokerExecutionPathDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-broker-execution-path-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});



app.get("/diagnostics/paper-attempt-read-only-order-placement-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_order_placement_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderPlacementDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-order-placement-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});






app.get("/diagnostics/paper-attempt-read-only-order-submission-lifecycle-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionLifecycleDiagnosticPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_lifecycle_diagnostic_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-lifecycle-diagnostic-panel",
      error: error?.message ?? String(error)
    });
  }
});

app.get("/diagnostics/paper-attempt-read-only-order-submission-response-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_order_submission_response_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionResponseDiagnosticPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_response_diagnostic_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-response-diagnostic-panel",
      error: error?.message ?? String(error)
    });
  }
});

app.get("/diagnostics/paper-attempt-read-only-order-submission-transport-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_order_submission_transport_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionTransportDiagnosticPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_transport_diagnostic_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-transport-diagnostic-panel",
      error: error?.message ?? String(error)
    });
  }
});

app.get("/diagnostics/paper-attempt-read-only-order-submission-payload-diagnostic-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel } = await import("./scanner/paper_attempt_read_only_order_submission_payload_diagnostic_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionPayloadDiagnosticPanel());
  } catch (err) {
    res.status(500).json({
      ok: false,
      route: "/diagnostics/paper-attempt-read-only-order-submission-payload-diagnostic-panel",
      error: err?.message || String(err)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-checklist-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_checklist_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorChecklistPanel());
  } catch (error) {
    res.status(500).json({ ok: false, version: "paper_attempt_read_only_order_submission_operator_checklist_panel_v1", route: "/diagnostics/paper-attempt-read-only-order-submission-operator-checklist-panel", error: error?.message ?? String(error) });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-decision-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_decision_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorDecisionPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_decision_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-decision-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-final-review-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_final_review_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorFinalReviewPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_final_review_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-final-review-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-completion-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_completion_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorCompletionPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_completion_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-completion-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-summary-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_summary_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorSummaryPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_summary_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-summary-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-audit-trail-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_audit_trail_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorAuditTrailPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_audit_trail_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-audit-trail-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-evidence-packet-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_evidence_packet_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorEvidencePacketPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_evidence_packet_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-evidence-packet-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-closeout-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_closeout_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorCloseoutPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_closeout_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-closeout-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-archive-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_archive_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorArchivePanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_archive_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-archive-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-retention-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_retention_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorRetentionPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_retention_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-retention-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-seal-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_seal_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorSealPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_seal_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-seal-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-custody-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_custody_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorCustodyPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_custody_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-custody-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-integrity-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_integrity_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorIntegrityPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_integrity_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-integrity-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-provenance-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_provenance_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorProvenancePanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_provenance_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-provenance-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-attestation-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_attestation_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorAttestationPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_attestation_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-attestation-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-certification-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_certification_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorCertificationPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_certification_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-certification-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-registry-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_registry_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_registry_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-registry-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-manifest-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_manifest_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_manifest_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-manifest-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-ledger-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_ledger_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorLedgerPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_ledger_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-ledger-panel",
      error: error?.message ?? String(error)
    });
  }
});
app.get("/diagnostics/paper-attempt-read-only-order-submission-operator-journal-panel", async (_req, res) => {
  try {
    const { buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel } = await import("./scanner/paper_attempt_read_only_order_submission_operator_journal_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOrderSubmissionOperatorJournalPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: "paper_attempt_read_only_order_submission_operator_journal_panel_v1",
      route: "/diagnostics/paper-attempt-read-only-order-submission-operator-journal-panel",
      error: error?.message ?? String(error)
    });
  }
});











































app.get("/diagnostics/market-closed-scanner-snapshot", (_req, res) => {
  try {
    const result = buildMarketClosedSnapshotDiagnostics({ skipScriptCheck: true });
    return res.json(result);
  } catch (err) {
    console.error("[market-closed-snapshot] diagnostics route error", err);
    return res.status(500).json({ ok: false, error: "market_closed_snapshot_diagnostics_route_error", monitorOnly: true, diagnosticsOnly: true, orderPlacementAllowed: false });
  }
});

app.get("/diagnostics/market-closed-scanner-snapshot-panel", (_req, res) => {
  try {
    const result = buildMarketClosedSnapshotPanel({ skipScriptCheck: true });
    return res.json(result);
  } catch (err) {
    console.error("[market-closed-snapshot] panel route error", err);
    return res.status(500).json({ ok: false, error: "market_closed_snapshot_panel_route_error", monitorOnly: true, diagnosticsOnly: true, readyForOrderPlacement: false });
  }
});


app.get("/diagnostics/market-closed-snapshot-app-screen", (req, res) => {
  res.json(buildMarketClosedSnapshotAppScreen({
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
    now: new Date(),
  }));
});

app.get("/app/market-closed-snapshot", (req, res) => {
  const screen = buildMarketClosedSnapshotAppScreen({
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
    now: new Date(),
  });
  res.type("html").send(renderMarketClosedSnapshotAppScreenHtml(screen));
});

app.post("/diagnostics/market-closed-scanner-snapshot-store/append", (_req, res) => {
  try {
    const result = appendMarketClosedSnapshotRecord({}, { skipScriptCheck: true });
    return res.json(result);
  } catch (err) {
    console.error("market-closed-snapshot-store] append route error", err);
    return res.status(500).json({
      ok: false,
      error: "market_closed_snapshot_store_append_route_error",
      monitorOnly: true,
      diagnosticsOnly: true,
      localStoreOnly: true,
      orderPlacementAllowed: false
    });
  }
});



app.get("/diagnostics/snapshot-store-app-screen", (req, res) => {
  res.json(buildSnapshotStoreAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  }));
});

app.get("/app/snapshot-store", (req, res) => {
  const screen = buildSnapshotStoreAppScreen({
    limit: req.query?.limit,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  });
  res.type("html").send(renderSnapshotStoreAppScreenHtml(screen));
});

app.get("/diagnostics/market-closed-scanner-snapshot-store/history", (req, res) => {
  try {
    const limit = req.query?.limit ?? 25;
    res.json(getStoreHistory({ limit }));
  } catch (err) {
    console.error("[market-closed-snapshot-store] history route error", err);
    res.status(500).json({ ok: false, error: "market_closed_snapshot_store_history_failed" });
  }
});

app.get("/diagnostics/market-closed-scanner-snapshot-store-panel", (req, res) => {
  try {
    const limit = req.query?.limit ?? 25;
    res.json(getStorePanel({ limit }));
  } catch (err) {
    console.error("[market-closed-snapshot-store] panel route error", err);
    res.status(500).json({ ok: false, error: "market_closed_snapshot_store_panel_failed" });
  }
});





app.get("/diagnostics/retention-cleanup-app-screen", (req, res) => {
  res.json(buildRetentionCleanupAppScreen({
    limit: req.query?.limit,
    retentionDays: req.query?.retentionDays,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  }));
});

app.get("/app/retention-cleanup", (req, res) => {
  const screen = buildRetentionCleanupAppScreen({
    limit: req.query?.limit,
    retentionDays: req.query?.retentionDays,
    refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
    now: new Date(),
  });
  res.type("html").send(renderRetentionCleanupAppScreenHtml(screen));
});

app.get("/diagnostics/market-closed-scanner-snapshot-store-retention-cleanup", (req, res) => {
  res.json(buildMarketClosedSnapshotStoreRetentionCleanupDiagnostics({ limit: req.query?.limit, retentionDays: req.query?.retentionDays }));
});

app.get("/diagnostics/market-closed-scanner-snapshot-store-retention-cleanup-panel", (req, res) => {
  res.json(buildMarketClosedSnapshotStoreRetentionCleanupPanel({ limit: req.query?.limit, retentionDays: req.query?.retentionDays }));
});


function escapeTodaysIntradaySetupsHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTodaysIntradaySetupsPanel(report) {
  const setupRows = report.setupUniverse
    .map((label) => `<li>${escapeTodaysIntradaySetupsHtml(label)}: ${escapeTodaysIntradaySetupsHtml(report.setupCounts?.[label] ?? 0)}</li>`)
    .join("\n");

  const candidateRows = report.candidates.length
    ? report.candidates.map((candidate) => {
        return `<tr><td>${escapeTodaysIntradaySetupsHtml(candidate.symbol)}</td><td>${escapeTodaysIntradaySetupsHtml(candidate.primarySetup)}</td><td>${escapeTodaysIntradaySetupsHtml(candidate.setupLabels.join(", "))}</td><td>${escapeTodaysIntradaySetupsHtml(candidate.reasons.join(", "))}</td></tr>`;
      }).join("\n")
    : '<tr><td colspan="4">No intraday candidates available in this diagnostic snapshot.</td></tr>';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Today&apos;s Intraday Setups Read-Only</title></head><body>
<h1>Today&apos;s Intraday Setups Read-Only</h1>
<ul>
<li>Display state: ${escapeTodaysIntradaySetupsHtml(report.displayState)}</li>
<li>Session: ${escapeTodaysIntradaySetupsHtml(report.session)}</li>
<li>Trade candidate count: ${escapeTodaysIntradaySetupsHtml(report.tradeCandidateCount)}</li>
<li>No-trade count: ${escapeTodaysIntradaySetupsHtml(report.noTradeCount)}</li>
<li>Read only: ${escapeTodaysIntradaySetupsHtml(report.readOnly)}</li>
<li>Order submitted: ${escapeTodaysIntradaySetupsHtml(report.orderSubmitted)}</li>
<li>Broker contact attempted: ${escapeTodaysIntradaySetupsHtml(report.brokerContactAttempted)}</li>
<li>Account mutation attempted: ${escapeTodaysIntradaySetupsHtml(report.accountMutationAttempted)}</li>
</ul>
<h2>Setup Counts</h2>
<ul>
${setupRows}
</ul>
<h2>Candidates</h2>
<table border="1" cellpadding="6" cellspacing="0">
<thead><tr><th>Symbol</th><th>Primary setup</th><th>Labels</th><th>Reasons</th></tr></thead>
<tbody>
${candidateRows}
</tbody>
</table>
</body></html>`;
}

function buildTodaysIntradaySetupsDiagnosticReport(req) {
  const requestedSession = typeof req.query?.session === "string" ? req.query.session : "unknown";
  const rankingRoot = readScannerRankings();
  const rankings = Array.isArray(rankingRoot?.rankings) ? rankingRoot.rankings : [];
  const enrichedRankings = rankings.map((ranking) => {
    const symbol = String(ranking?.symbol ?? "").toUpperCase();
    const snapshot = symbol ? buildLiveSnapshot(symbol, { symbol }) : {};
    return enrichScannerRankingWithIntradayFeatures(ranking, snapshot);
  });
  const session = typeof rankingRoot?.session === "string" ? rankingRoot.session : requestedSession;

  const report = buildTodaysIntradaySetups({
    rankings: enrichedRankings,
    session,
    now: new Date()
  });

  return {
    ...report,
    source: "scanner_rankings",
    intradayFeatureSource: "live_snapshot_bars",
    scannerHealth: rankingRoot?.scannerHealth ?? null,
    rankingConfidence: rankingRoot?.rankingConfidence ?? null,
    rankingCount: rankings.length,
    sourceTs: rankingRoot?.sourceTs ?? rankingRoot?.ts ?? null,
    sourceAgeSec: rankingRoot?.sourceAgeSec ?? null,
    sourceStale: rankingRoot?.stale ?? null
  };
}

app.get("/diagnostics/todays-intraday-setups-readonly", (req, res) => {
  res.json(buildTodaysIntradaySetupsDiagnosticReport(req));
});

app.get("/diagnostics/todays-intraday-setups-readonly-panel", (req, res) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(302, `/app/todays-intraday-setups${query}`);
});

app.get("/diagnostics/todays-intraday-setups-app-card", (req, res) => {
  res.json(buildTodaysIntradaySetupsAppCard(buildTodaysIntradaySetupsDiagnosticReport(req)));
});

app.get("/diagnostics/todays-intraday-setup-detail", (req, res) => {
  const card = buildTodaysIntradaySetupsAppCard(buildTodaysIntradaySetupsDiagnosticReport(req));
  res.json(buildTodaysIntradaySetupDetailAppCard(card, {
    symbol: req.query.symbol ?? req.query.ticker ?? ""
  }));
});

app.get("/app/todays-intraday-setups", (req, res) => {
  const loadSourceReport = ["1", "true", "yes", "full"].includes(
    String(req.query.loadSources ?? req.query.loadSourceReport ?? "").toLowerCase()
  );
  const now = new Date();
  const report = loadSourceReport ? buildTodaysIntradaySetupsDiagnosticReport(req) : {
    ok: true,
    version: "todays_intraday_setups_fast_preview_v1",
    ts: now.toISOString(),
    generatedAt: now.toISOString(),
    title: "Today's Intraday Setups",
    displayState: "TODAYS_INTRADAY_SETUPS_FAST_PREVIEW_READONLY",
    status: "fast_preview_readonly",
    session: req.query.session ?? "regular",
    candidates: [],
    tradeCandidates: [],
    noTrade: [],
    source: "fast_preview",
    intradayFeatureSource: "source_report_not_loaded",
    scannerHealth: null,
    rankingConfidence: null,
    rankingCount: 0,
    sourceTs: null,
    sourceAgeSec: null,
    sourceStale: null,
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh ?? 30,
    readOnly: true,
    monitorOnly: true,
    noExecutionControls: true
  };
  res.type("html").send(renderTodaysIntradaySetupsAppCardHtml(buildTodaysIntradaySetupsAppCard(report)));
});

app.get("/app/todays-intraday-setups/:symbol", (req, res) => {
  const card = buildTodaysIntradaySetupsAppCard(buildTodaysIntradaySetupsDiagnosticReport(req));
  const detail = buildTodaysIntradaySetupDetailAppCard(card, {
    symbol: req.params.symbol ?? "",
  });
  res.type("html").send(renderTodaysIntradaySetupDetailAppCardHtml(detail));
});




app.get("/diagnostics/watchlist-settings-readonly", (req, res) => {
  res.json(buildWatchlistSettingsReadonly({
    symbols: req.query.symbols ?? process.env.ALPACA_SYMBOLS,
    session: req.query.session ?? "regular",
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh ?? 30,
    now: new Date(),
  }));
});

app.get("/app/watchlist-settings", (req, res) => {
  const panel = buildWatchlistSettingsReadonly({
    symbols: req.query.symbols ?? process.env.ALPACA_SYMBOLS,
    session: req.query.session ?? "regular",
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh ?? 30,
    now: new Date(),
  });
  res.type("html").send(renderWatchlistSettingsReadonlyHtml(panel));
});


app.get("/diagnostics/snapshot-history-app-screen", (req, res) => {
  res.json(buildSnapshotHistoryAppScreen({
    limit: req.query.limit,
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
    now: new Date(),
  }));
});

app.get("/app/snapshot-history", (req, res) => {
  const screen = buildSnapshotHistoryAppScreen({
    limit: req.query.limit,
    refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
    now: new Date(),
  });
  res.type("html").send(renderSnapshotHistoryAppScreenHtml(screen));
});

app.get("/diagnostics/exit-all-control-readonly", (req, res) => {
  const payload = buildExitAllControlReadonly({
    now: new Date(),
    requestedAction: req.query.action,
    inventorySource: req.query.source,
    futureAutoModeKnown: req.query.futureAutoModeKnown,
  });
  res.json(payload);
});

app.get("/app/exit-all", (req, res) => {
  const payload = buildExitAllControlReadonly({
    now: new Date(),
    requestedAction: req.query.action,
    inventorySource: req.query.source,
    futureAutoModeKnown: req.query.futureAutoModeKnown,
  });
  res.type("html").send(renderExitAllControlReadonlyHtml(payload));
});

app.get("/diagnostics/internal-owner-tenant-readonly", requireInternalOwnerAuth, requireInternalOwnerAuthorization, requireInternalOwnerTenantIsolation, (req, res) => {
  const tenantId = req.internalOwnerTenantContext.tenantId;
  res.json(buildInternalOwnerTenantReadonly({
    tenantId,
    credentialStoreStatus: buildInternalOwnerTenantCredentialStoreStatus({
      tenantId,
      masterKey: process.env.GEMINI_CREDENTIAL_MASTER_KEY,
    }),
  }));
});

app.get("/app/internal-owner", requireInternalOwnerAuth, requireInternalOwnerAuthorization, requireInternalOwnerTenantIsolation, (req, res) => {
  const tenantId = req.internalOwnerTenantContext.tenantId;
  res.type("html").send(renderInternalOwnerTenantAppScreenHtml(buildInternalOwnerTenantAppScreen({
    tenantId,
    credentialStoreStatus: buildInternalOwnerTenantCredentialStoreStatus({
      tenantId,
      masterKey: process.env.GEMINI_CREDENTIAL_MASTER_KEY,
    }),
  })));
});

app.get("/diagnostics/app-navigation-readonly", (req, res) => {
  res.json(buildAppNavigationReadonly({ now: new Date() }));
});

app.get("/app", (req, res) => {
  res.type("html").send(renderAppNavigationReadonlyHtml(buildAppNavigationReadonly({ now: new Date() })));
});


app.listen(PORT, HOST, async () => {
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  try {
    await startMarketDataStream();
    console.log('[server] market data stream started');
  } catch (e) {
    console.error('[server] market data stream failed to start:', e);
  }
});























app.get('/diagnostics/paper-trade-module-completion-report', (_req, res) => {
  res.json(buildPaperTradeModuleCompletionReport());
});


app.get('/diagnostics/paper-trade-module-completion-report-panel', (_req, res) => {
  res.json(buildPaperTradeModuleCompletionReportPanel());
});

app.get('/diagnostics/paper-trade-broker-integration-preflight-stack', (_req, res) => {
  res.json(evaluatePaperTradeBrokerIntegrationPreflightStack());
});


app.get('/diagnostics/paper-trade-broker-integration-preflight-stack-panel', (_req, res) => {
  res.json(readPaperTradeBrokerIntegrationPreflightStackPanel());
});



app.get('/diagnostics/paper-trading-final-go-no-go-panel', async (_req, res) => {
  try {
    const payload = await getPaperTradingFinalGoNoGoDiagnostics();
    res.json({
      ...payload,
      version: 'paper_trading_final_go_no_go_panel_v1',
      panelType: 'operator_dashboard_card',
      title: 'Paper Trading Final Go / No-Go',
      route: '/diagnostics/paper-trading-final-go-no-go-panel',
      refreshRoute: '/diagnostics/paper-trading-final-go-no-go',
      readOnly: true,
      monitorOnly: true,
      noExecutionControls: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false
    });
  } catch (error) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-trading-final-go-no-go-panel', error: error?.message ?? String(error) });
  }
});

app.get('/diagnostics/paper-trade-operator-go-no-go', (_req, res) => {
  res.json(buildPaperTradeOperatorGoNoGo());
});

app.get('/diagnostics/paper-trade-operator-go-no-go-panel', (_req, res) => {
  res.json(buildPaperTradeOperatorGoNoGoPanel());
});

app.get('/app/paper-trading-overview-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trading_overview_status_app_screen.mjs');
    const screen = mod.buildPaperTradingOverviewStatusAppScreen();
    res.type('html').send(mod.renderPaperTradingOverviewStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trading_overview_status_app_screen_failed', message: err?.message ?? String(err) });
  }
});

app.get('/diagnostics/paper-app-route-health-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_route_health_status_app_screen.mjs');
    const screen = mod.buildPaperAppRouteHealthStatusAppScreen();
    res.json(screen);
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-route-health-status', error: 'paper_app_route_health_status_diagnostics_failed', message: err?.message ?? String(err) });
  }
});

app.get('/diagnostics/paper-app-route-health-status-panel', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_route_health_status_app_screen.mjs');
    const screen = mod.buildPaperAppRouteHealthStatusAppScreen();
    res.json({
      ok: true,
      route: '/diagnostics/paper-app-route-health-status-panel',
      version: screen.version,
      title: screen.title,
      status: screen.status,
      displayState: screen.displayState,
      readOnly: screen.readOnly,
      monitorOnly: screen.monitorOnly,
      diagnosticsOnly: screen.diagnosticsOnly,
      noExecutionControls: screen.noExecutionControls,
      missingServerRoutes: screen.missingServerRoutes ?? [],
      summary: screen.summary,
      safety: screen.safety,
      ts: screen.ts
    });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-route-health-status-panel', error: 'paper_app_route_health_status_panel_failed', message: err?.message ?? String(err) });
  }
});

app.get('/app/paper-app-route-health-status', async (req, res) => {
  try {
    const mod = await import('./scanner/paper_app_route_health_status_app_screen.mjs');
    const screen = mod.buildPaperAppRouteHealthStatusAppScreen();
    res.type('html').send(mod.renderPaperAppRouteHealthStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_app_route_health_status_app_screen_failed', message: err?.message ?? String(err) });
  }
});


app.get('/diagnostics/paper-app-safety-lock-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_safety_lock_status_app_screen.mjs');
    const screen = mod.buildPaperAppSafetyLockStatusAppScreen();
    res.json(screen);
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-safety-lock-status', error: 'paper_app_safety_lock_status_diagnostics_failed', message: err?.message ?? String(err) });
  }
});

app.get('/diagnostics/paper-app-safety-lock-status-panel', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_safety_lock_status_app_screen.mjs');
    const screen = mod.buildPaperAppSafetyLockStatusAppScreen();
    res.json({
      ok: true,
      route: '/diagnostics/paper-app-safety-lock-status-panel',
      version: screen.version,
      title: screen.title,
      status: screen.status,
      displayState: screen.displayState,
      readOnly: screen.readOnly,
      monitorOnly: screen.monitorOnly,
      diagnosticsOnly: screen.diagnosticsOnly,
      noExecutionControls: screen.noExecutionControls,
      summary: screen.summary,
      safety: screen.safety,
      ts: screen.ts
    });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-safety-lock-status-panel', error: 'paper_app_safety_lock_status_panel_failed', message: err?.message ?? String(err) });
  }
});

app.get('/app/paper-app-safety-lock-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_safety_lock_status_app_screen.mjs');
    const screen = mod.buildPaperAppSafetyLockStatusAppScreen();
    res.type('html').send(mod.renderPaperAppSafetyLockStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_app_safety_lock_status_app_screen_failed', message: err?.message ?? String(err) });
  }
});


app.get('/diagnostics/paper-app-broker-readiness-index', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_broker_readiness_index_app_screen.mjs');
    const screen = mod.buildPaperAppBrokerReadinessIndexAppScreen();
    res.json(screen);
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-broker-readiness-index', error: 'paper_app_broker_readiness_index_diagnostics_failed', message: err?.message ?? String(err) });
  }
});

app.get('/diagnostics/paper-app-broker-readiness-index-panel', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_broker_readiness_index_app_screen.mjs');
    const screen = mod.buildPaperAppBrokerReadinessIndexAppScreen();
    res.json({
      ok: true,
      route: '/diagnostics/paper-app-broker-readiness-index-panel',
      version: screen.version,
      title: screen.title,
      status: screen.status,
      displayState: screen.displayState,
      readOnly: screen.readOnly,
      monitorOnly: screen.monitorOnly,
      diagnosticsOnly: screen.diagnosticsOnly,
      noExecutionControls: screen.noExecutionControls,
      missingRequiredRoutes: screen.missingRequiredRoutes ?? [],
      summary: screen.summary,
      safety: screen.safety,
      ts: screen.ts
    });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-app-broker-readiness-index-panel', error: 'paper_app_broker_readiness_index_panel_failed', message: err?.message ?? String(err) });
  }
});

app.get('/app/paper-app-broker-readiness-index', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_app_broker_readiness_index_app_screen.mjs');
    const screen = mod.buildPaperAppBrokerReadinessIndexAppScreen();
    res.type('html').send(mod.renderPaperAppBrokerReadinessIndexAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_app_broker_readiness_index_app_screen_failed', message: err?.message ?? String(err) });
  }
});

app.get('/app/paper-broker-runtime-environment-preflight', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_broker_runtime_environment_preflight_app_screen.mjs');
    const screen = mod.buildPaperBrokerRuntimeEnvironmentPreflightAppScreen();
    res.type('html').send(mod.renderPaperBrokerRuntimeEnvironmentPreflightAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_broker_runtime_environment_preflight_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/diagnostics/paper-broker-runtime-environment-preflight', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_broker_runtime_environment_preflight.mjs');
    const payload = await mod.buildPaperBrokerRuntimeEnvironmentPreflight({ preflightOnly: true });
    res.json({ ...payload, route: '/diagnostics/paper-broker-runtime-environment-preflight' });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-broker-runtime-environment-preflight', error: err?.message ?? String(err) });
  }
});


app.get('/app/paper-broker-network-attempt-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_broker_network_attempt_status_app_screen.mjs');
    const screen = mod.buildPaperBrokerNetworkAttemptStatusAppScreen();
    res.type('html').send(mod.renderPaperBrokerNetworkAttemptStatusAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_broker_network_attempt_status_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/diagnostics/paper-broker-network-attempt-status', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_broker_network_attempt_status_app_screen.mjs');
    const payload = await mod.buildPaperBrokerNetworkAttemptStatusAppScreen({ loadSourceReport: false });
    res.json({ ...payload, route: '/diagnostics/paper-broker-network-attempt-status' });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-broker-network-attempt-status', error: err?.message ?? String(err) });
  }
});


app.get('/app/paper-trade-broker-integration-preflight', async (_req, res) => {
  res.redirect(302, '/app/paper-trade-broker-integration-preflight-stack');
});

app.get('/app/paper-trade-broker-integration-preflight-stack', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_broker_integration_preflight_stack_app_screen.mjs');
    const screen = mod.buildPaperTradeBrokerIntegrationPreflightStackAppScreen();
    res.type('html').send(mod.renderPaperTradeBrokerIntegrationPreflightStackAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_broker_integration_preflight_stack_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-broker-adapter-approval-lock', async (_req, res) => {
  try {
    const panel = buildPaperBrokerAdapterApprovalLockPanel();
    const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const reasons = Array.isArray(panel.lockReasons) ? panel.lockReasons : [];
    res.type('html').send([
      "<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Paper Broker Adapter Approval Lock</title></head><body><main>",
      "<p><a href='/app'>Back to GeminiScanner App</a></p><h1>", esc(panel.title), "</h1><p>", esc(panel.summary), "</p>",
      "<section><h2>Approval Lock Status</h2>",
      "<p>Status: <strong>", esc(panel.status), "</strong></p><p>Broker adapter enabled: <strong>", esc(panel.brokerAdapterEnabled), "</strong></p>",
      "<p>Approval lock passed: <strong>", esc(panel.approvalLockPassed), "</strong></p><p>Explicit approval record found: <strong>", esc(panel.hasExplicitApprovalRecord), "</strong></p>",
      "<p>Valid approval record count: <strong>", esc(panel.validApprovalRecordCount), "</strong></p></section>",
      "<section><h2>Safety Locks</h2><p>brokerContactAllowed=", esc(panel.brokerContactAllowed), "</p><p>orderPlacementAllowed=", esc(panel.orderPlacementAllowed), "</p><p>accountMutationAllowed=", esc(panel.accountMutationAllowed), "</p></section>",
      "<section><h2>Lock Reasons</h2><ul>", reasons.length ? reasons.map((r) => `<li>${esc(r)}</li>`).join("") : "<li>none</li>", "</ul></section>",
      "<section><h2>Related Broker Readiness Routes</h2><ul><li><a href='/app/paper-operator-start-here'>Paper Operator Start Here</a></li><li><a href='/app/paper-app-broker-readiness-index'>Paper App Broker Readiness Index</a></li><li><a href='/app/paper-broker-adapter-approval-record-tool'>Paper Broker Adapter Approval Record Tool</a></li><li><a href='/app/paper-trade-broker-adapter-guard'>Paper Trade Broker Adapter Guard</a></li><li><a href='/app/paper-trade-operator-go-no-go'>Paper Trade Operator Go / No-Go</a></li><li><a href='/diagnostics/paper-broker-adapter-approval-lock-panel'>Diagnostic panel payload</a></li></ul></section>",
      "<section><h2>Display State</h2><p>PAPER_BROKER_ADAPTER_APPROVAL_LOCK_READONLY</p><p>read-only. Monitor-only. Diagnostics-only. No broker contact, no order placement, no account mutation, no execution controls.</p></section>",
      "</main></body></html>"
    ].join(''));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_broker_adapter_approval_lock_app_route_failed', message: err?.message ?? String(err) });
  }
});

app.get('/app/paper-trade-broker-adapter-guard', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_broker_adapter_guard_app_screen.mjs');
    const screen = mod.buildPaperTradeBrokerAdapterGuardAppScreen();
    res.type('html').send(mod.renderPaperTradeBrokerAdapterGuardAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_broker_adapter_guard_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-trade-execution-control-stack', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_execution_control_stack_app_screen.mjs');
    const screen = mod.buildPaperTradeExecutionControlStackAppScreen();
    res.type('html').send(mod.renderPaperTradeExecutionControlStackAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_execution_control_stack_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-trade-operator-go-no-go', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_operator_go_no_go_app_screen.mjs');
    const screen = mod.buildPaperTradeOperatorGoNoGoAppScreen();
    res.type('html').send(mod.renderPaperTradeOperatorGoNoGoAppScreenHtml(screen));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'paper_trade_operator_go_no_go_app_screen_failed', message: err?.message || String(err) });
  }
});

app.get('/app/paper-trade-readiness', (_req, res) => res.redirect(302, '/app/paper-trade-readiness-report'));
app.get('/app/paper-trading-readiness', (_req, res) => res.redirect(302, '/app/paper-trade-readiness-report'));
app.get('/app/paper-trading-readiness-gate', (_req, res) => res.redirect(302, '/app/paper-readiness-gate'));
app.get('/app/paper-operator-go-no-go', (_req, res) => res.redirect(302, '/app/paper-trade-operator-go-no-go'));
app.get('/paper-trading-module-final-status', (_req, res) => res.redirect(302, '/app/paper-trading-module-final-status'));

app.get('/app/paper-trade-readiness-report', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_trade_readiness_report_app_screen.mjs');
    const screen = mod.buildPaperTradeReadinessReportAppScreen({});
    res.type('html').send(mod.renderPaperTradeReadinessReportAppScreenHtml(screen));
  } catch (err) {
    res.status(500).type('text').send(err?.message ?? 'paper trade readiness report app screen failed');
  }
});

app.get('/diagnostics/paper-trade-readiness-report', (_req, res) => {
  res.json(buildPaperTradeReadinessReport());
});


app.get('/diagnostics/paper-trade-readiness-report-panel', (_req, res) => {
  res.json(buildPaperTradeReadinessReportPanel());
});

app.get('/diagnostics/paper-trade-execution-control-stack', (_req, res) => {
  res.json(evaluatePaperTradeExecutionControlStack());
});


app.get('/diagnostics/paper-trade-execution-control-stack-panel', (_req, res) => {
  res.json(readPaperTradeExecutionControlStackPanel());
});

app.get('/diagnostics/paper-trade-broker-adapter-guard', (_req, res) => {
  res.json(evaluatePaperTradeBrokerAdapterGuard());
});


app.get('/diagnostics/paper-trade-broker-adapter-guard-panel', (_req, res) => {
  res.json(readPaperTradeBrokerAdapterGuardPanel());
});

app.get('/diagnostics/paper-trade-lifecycle-runner-audit', (_req, res) => {
  res.json(readPaperTradeLifecycleRunnerAuditDashboard());
});


app.get('/diagnostics/paper-trade-lifecycle-runner-audit-panel', (_req, res) => {
  res.json(readPaperTradeLifecycleRunnerAuditPanel());
});

app.get('/diagnostics/paper-trade-lifecycle-runner', (_req, res) => {
  res.json(previewPaperTradeLifecycleRun());
});


app.get('/diagnostics/paper-trade-lifecycle-runner-panel', (_req, res) => {
  res.json(readPaperTradeLifecycleRunnerPanel());
});

app.get('/diagnostics/paper-trade-lifecycle-dashboard', (_req, res) => {
  res.json(readPaperTradeLifecycleDashboard());
});


app.get('/diagnostics/paper-trade-lifecycle-dashboard-panel', (_req, res) => {
  res.json(readPaperTradeLifecycleDashboardPanel());
});

app.get('/diagnostics/paper-trade-position-state-store', (_req, res) => {
  res.json(readPaperTradePositionStateStoreDashboard());
});


app.get('/diagnostics/paper-trade-position-state-store-panel', (_req, res) => {
  res.json(readPaperTradePositionStateStorePanel());
});

app.get('/diagnostics/paper-trade-position-state-preview', (_req, res) => {
  res.json(buildPaperTradePositionStatePreview());
});


app.get('/diagnostics/paper-trade-position-state-preview-panel', (_req, res) => {
  res.json(buildPaperTradePositionStatePreviewPanel());
});

app.get('/diagnostics/paper-trade-fill-simulation-store', (_req, res) => {
  res.json(readPaperTradeFillSimulationStoreDashboard());
});


app.get('/diagnostics/paper-trade-fill-simulation-store-panel', (_req, res) => {
  res.json(readPaperTradeFillSimulationStorePanel());
});

app.get('/diagnostics/paper-trade-fill-simulation-preview', (_req, res) => {
  res.json(buildPaperTradeFillSimulationPreview());
});


app.get('/diagnostics/paper-trade-fill-simulation-preview-panel', (_req, res) => {
  res.json(buildPaperTradeFillSimulationPreviewPanel());
});

app.get('/diagnostics/paper-trade-order-ticket-store', (_req, res) => {
  res.json(readPaperTradeOrderTicketStoreDashboard());
});


app.get('/diagnostics/paper-trade-order-ticket-store-panel', (_req, res) => {
  res.json(readPaperTradeOrderTicketStorePanel());
});

app.get('/diagnostics/paper-trade-order-ticket-preview', (_req, res) => {
  res.json(buildPaperTradeOrderTicketPreview());
});


app.get('/diagnostics/paper-trade-order-ticket-preview-panel', (_req, res) => {
  res.json(buildPaperTradeOrderTicketPreviewPanel());
});

app.get('/diagnostics/paper-trade-sizing-preview', (_req, res) => {
  res.json(buildPaperTradeSizingPreview());
});


app.get('/diagnostics/paper-trade-sizing-preview-panel', (_req, res) => {
  res.json(buildPaperTradeSizingPreviewPanel());
});

app.get('/diagnostics/paper-trade-execution-payload-preview', (_req, res) => {
  res.json(buildPaperTradeExecutionPayloadPreview());
});


app.get('/diagnostics/paper-trade-execution-payload-preview-panel', (_req, res) => {
  res.json(buildPaperTradeExecutionPayloadPreviewPanel());
});

app.get('/diagnostics/paper-trade-intent-creation-runner-audit-panel', (_req, res) => {
  res.json(readPaperTradeIntentCreationRunnerAuditPanel());
});

app.get('/diagnostics/paper-trade-intent-creation-runner-audit', (_req, res) => {
  res.json(readPaperTradeIntentCreationRunnerAuditDashboard());
});

app.get('/diagnostics/paper-trade-intent-creation-runner-panel', (_req, res) => {
  res.json(readPaperTradeIntentCreationRunnerPanel());
});

app.get('/diagnostics/paper-trade-intent-creation-runner', (_req, res) => {
  res.json(previewPaperTradeIntentCreationFromPlan());
});

app.get('/diagnostics/paper-trade-intent-creation-store-panel', (_req, res) => {
  res.json(readPaperTradeIntentCreationDashboardPanel());
});

app.get('/diagnostics/paper-trade-intent-creation-store', (_req, res) => {
  res.json(readPaperTradeIntentCreationDashboard());
});

app.get('/diagnostics/paper-trade-intent-audit-dashboard', (_req, res) => {
  res.json(buildPaperTradeIntentAuditDashboard());
});



app.get('/diagnostics/paper-broker-adapter-approval-lock', (_req, res) => {
  res.json(buildPaperBrokerAdapterApprovalLock());
});

app.get('/diagnostics/paper-broker-adapter-approval-lock-panel', (_req, res) => {
  res.json(buildPaperBrokerAdapterApprovalLockPanel());
});

app.get('/diagnostics/paper-trade-intent-audit-dashboard-panel', async (_req, res) => {
  try {
    res.json(await getPaperTradeIntentAuditDashboardPanel());
  } catch (error) {
    res.status(500).json({
      ok: false,
      version: 'paper_trade_intent_audit_dashboard_panel_v1',
      monitorOnly: true,
      error: error?.message || 'paper_trade_intent_audit_dashboard_panel_failed'
    });
  }
});



// BEGIN PAPER_ATTEMPT_READ_ONLY_OPERATOR_SUMMARY_APP_SCREEN_V1
app.get("/diagnostics/paper-attempt-read-only-operator-summary-app-screen", async (req, res, next) => {
  try {
    const { buildPaperAttemptReadOnlyOperatorSummaryAppScreen } = await import("./scanner/paper_attempt_read_only_operator_summary_app_screen.mjs");
    res.json(buildPaperAttemptReadOnlyOperatorSummaryAppScreen({
      refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
      now: new Date()
    }));
  } catch (err) {
    next(err);
  }
});

app.get("/app/readonly-operator-summary", async (req, res, next) => {
  try {
    const {
      buildPaperAttemptReadOnlyOperatorSummaryAppScreen,
      renderPaperAttemptReadOnlyOperatorSummaryAppScreenHtml,
    } = await import("./scanner/paper_attempt_read_only_operator_summary_app_screen.mjs");
    const screen = buildPaperAttemptReadOnlyOperatorSummaryAppScreen({
      refreshIntervalSec: req.query?.refreshIntervalSec ?? req.query?.refresh,
      now: new Date()
    });
    res.type("html").send(renderPaperAttemptReadOnlyOperatorSummaryAppScreenHtml(screen));
  } catch (err) {
    next(err);
  }
});
// END PAPER_ATTEMPT_READ_ONLY_OPERATOR_SUMMARY_APP_SCREEN_V1

// BEGIN PAPER_ATTEMPT_READ_ONLY_OPERATOR_SUMMARY_PANEL_V1
app.get("/diagnostics/paper-attempt-read-only-operator-summary-panel", async (req, res, next) => {
  try {
    const { buildPaperAttemptReadOnlyOperatorSummaryPanel } = await import("./scanner/paper_attempt_read_only_operator_summary_panel.mjs");
    res.json(buildPaperAttemptReadOnlyOperatorSummaryPanel());
  } catch (err) {
    next(err);
  }
});

app.get("/diagnostics/paper-attempt-read-only-operator-summary-panel-view", (_req, res) => {
  res.redirect(302, "/app/readonly-operator-summary");
});
// END PAPER_ATTEMPT_READ_ONLY_OPERATOR_SUMMARY_PANEL_V1


app.get('/diagnostics/alpaca-operator-key-entry', async (_req, res) => {
  const mod = await import('./scanner/alpaca_operator_key_entry_block.mjs');
  res.json(mod.getAlpacaOperatorKeyEntryBlockDiagnostics());
});

app.get('/app/alpaca-operator-key-entry', async (_req, res) => {
  const mod = await import('./scanner/alpaca_operator_key_entry_block.mjs');
  res.type('html').send(mod.renderAlpacaOperatorKeyEntryBlockHtml());
});



app.get('/diagnostics/alpaca-under-five-universe-readonly', async (req, res) => {
  try {
    const mod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const result = await mod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: req.query.minPrice ?? 0.5,
      maxPrice: req.query.maxPrice ?? 5,
      minDailyVolume: req.query.minDailyVolume ?? 100000,
      snapshotBatchSize: req.query.snapshotBatchSize ?? 200,
      maxAssets: req.query.maxAssets ?? 10000,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: 'under_five_universe_readonly_failed',
      error: err?.message ?? String(err),
      readOnly: true,
      orderSubmitAllowed: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
    });
  }
});


app.get('/diagnostics/alpaca-under-five-universe-app-card', async (req, res) => {
  try {
    const dataMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const viewMod = await import('./scanner/alpaca_under_five_universe_app_card.mjs');
    const source = await dataMod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: req.query.minPrice ?? 0.5,
      maxPrice: req.query.maxPrice ?? 5,
      minDailyVolume: req.query.minDailyVolume ?? 100000,
      snapshotBatchSize: req.query.snapshotBatchSize ?? 200,
      maxAssets: req.query.maxAssets ?? 10000,
    });
    res.json(viewMod.buildAlpacaUnderFiveUniverseAppCard(source, {
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now: new Date(),
    }));
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: 'under_five_universe_app_card_failed',
      error: err?.messae ?? String(err),
      readOnly: true,
      noExecutionControls: true,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
    });
  }
});

app.get('/app/alpaca-under-five-universe', async (req, res) => {
  try {
    const dataMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const viewMod = await import('./scanner/alpaca_under_five_universe_app_card.mjs');
    const source = await dataMod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: req.query.minPrice ?? 0.5,
      maxPrice: req.query.maxPrice ?? 5,
      minDailyVolume: req.query.minDailyVolume ?? 100000,
      snapshotBatchSize: req.query.snapshotBatchSize ?? 200,
      maxAssets: req.query.maxAssets ?? 10000,
    });
    const card = viewMod.buildAlpacaUnderFiveUniverseAppCard(source, {
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now: new Date(),
    });
    res.type('html').send(viewMod.renderAlpacaUnderFiveUniverseAppCardHtml(card));
  } catch (err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Under $5 Read-Only Potential</h1><p>Unavailable.</p><p>No execution controls.</p></body></html>');
  }
});


app.get('/customer-zero/scanner', async (_req, res) => {
  const mod = await import('./scanner/customer_zero_scanner_hub.mjs');
  const hub = mod.buildCustomerZeroScannerHub();
  res.type('html').send(mod.renderCustomerZeroScannerHubHtml(hub));
});


app.get('/customer-zero/under-five-scanner/:symbol', async (req, res) => {
  try {
    const dataMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const detailMod = await import('./scanner/customer_zero_under_five_symbol_detail.mjs');
    const source = await dataMod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: req.query.minPrice ?? 0.5,
      maxPrice: req.query.maxPrice ?? 5,
      minDailyVolume: req.query.minDailyVolume ?? 100000,
      snapshotBatchSize: req.query.snapshotBatchSize ?? 200,
      maxAssets: req.query.maxAssets ?? 10000,
    });
    const symbol = String(req.params.symbol ?? '').trim().toUpperCase();
    const candidate = source.candidates?.find((item) => item.symbol === symbol);
    if (!candidate) {
      return res.status(404).type('html').send('<!doctype html><html><body><h1>Symbol not found</h1><p>Return to the scanner.</p></body></html>');
    }
    const detail = detailMod.buildCustomerZeroUnderFiveSymbolDetail(candidate);
    res.type('html').send(detailMod.renderCustomerZeroUnderFiveSymbolDetailHtml(detail));
  } catch (err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Scan detail unavailable</h1><p>Read-only. No execution controls.</p></body></html>');
  }
});


app.get('/customer-zero/under-five-scanner', async (req, res) => {
  try {
    const dataMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const viewMod = await import('./scanner/customer_zero_under_five_dashboard.mjs');
    const source = await dataMod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: req.query.minPrice ?? 0.5,
      maxPrice: req.query.maxPrice ?? 5,
      minDailyVolume: req.query.minDailyVolume ?? 100000,
      snapshotBatchSize: req.query.snapshotBatchSize ?? 200,
      maxAssets: req.query.maxAssets ?? 10000,
    });
    const dashboard = viewMod.buildCustomerZeroUnderFiveDashboard(source, {
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh ?? 30,
      now: new Date(),
    });
    res.type('html').send(viewMod.renderCustomerZeroUnderFiveDashboardHtml(dashboard));
  } catch (err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Customer Zero — Under $5 Scanner</h1><p>Unavailable.</p><p>Read-only. No execution controls.</p></body></html>');
  }
});


app.get('/diagnostics/alpaca-paper-account-dashboard', async (_req, res) => {
  const view = await import('./scanner/alpaca_paper_account_dashboard_readonly.mjs');
  const data = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const fetched = await data.fetchAlpacaPaperAccountReadonly();
  res.json(view.buildAlpacaPaperAccountDashboardReadonly({
    connected: fetched.status === "connected_readonly",
    networkReadImplemented: true,
    account: fetched.account ?? {},
    positions: fetched.positions ?? [],
    env: process.env,
    fetchResult: fetched,
  }));
});

app.get('/app/alpaca-paper-account-dashboard', async (_req, res) => {
  const view = await import('./scanner/alpaca_paper_account_dashboard_readonly.mjs');
  const data = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const fetched = await data.fetchAlpacaPaperAccountReadonly();
  const panel = view.buildAlpacaPaperAccountDashboardReadonly({
    connected: fetched.status === "connected_readonly",
    networkReadImplemented: true,
    account: fetched.account ?? {},
    positions: fetched.positions ?? [],
    env: process.env,
    fetchResult: fetched,
  });
  panel.summary.operatorMessage = fetched.summary?.operatorMessage ?? panel.summary.operatorMessage;
  res.type('html').send(view.renderAlpacaPaperAccountDashboardReadonlyHtml(panel));
});
