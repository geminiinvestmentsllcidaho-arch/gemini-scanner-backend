import { buildPaperAttemptOperatorReviewPacketPanel, renderPaperAttemptOperatorReviewPacketPanelHtml } from "./scanner/paper_attempt_operator_review_packet_panel.mjs";
import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from './scanner/global_theme.mjs';

function escapeThemedStatusHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderThemedStatusPage({
  surface = "public",
  title,
  message,
  href = "/",
  linkLabel = "Return home",
}) {
  const homeHref = surface === "customer" ? "/customer" : "/";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeThemedStatusHtml(title)} · GeminiScanner</title>${renderGlobalThemeCss({ surface })}<style>main.gs-status-page{width:min(680px,calc(100% - 32px));margin:clamp(36px,10vh,110px) auto;padding:clamp(22px,5vw,38px)}main.gs-status-page p{line-height:1.65;color:var(--gs-muted)}main.gs-status-page a{display:inline-block;margin-top:8px;font-family:var(--gs-font-display);font-weight:700;text-decoration:none}</style></head><body>${renderBackgroundLogoLayer()}${renderGlobalHeader({ surface, homeHref, label: "GeminiScanner" })}<main class="gs-status-page card"><h1>${escapeThemedStatusHtml(title)}</h1><p>${escapeThemedStatusHtml(message)}</p><p><a href="${escapeThemedStatusHtml(href)}">${escapeThemedStatusHtml(linkLabel)}</a></p></main>${renderGlobalFooter()}</body></html>`;
}
import {
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
} from './scanner/customer_primary_navigation.mjs';
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
import path from "node:path";
import dotenv from 'dotenv';
import express from 'express';
import { injectGeminiScannerBrandHeader } from './scanner/brand_header.mjs';
import { buildCustomerSignupPage, renderCustomerSignupPageHtml } from './scanner/customer_signup_page.mjs';
import { createCustomerAccountRecord, appendCustomerAccountRecord, findCustomerAccountByEmail, findCustomerAccountById, markCustomerEmailVerified, beginCustomerEmailChange, completeCustomerEmailChange, buildCustomerDataExport, updateCustomerPassword, resetCustomerPassword, updateCustomerProfile, updateCustomerNotificationPreferences, updateCustomerDisplayPreferences, getCustomerZeroResultFilters, updateCustomerZeroResultFilters, getCustomerScannerSelections, updateCustomerScannerSelections, beginCustomerAuthenticatorSetup, confirmCustomerAuthenticatorSetup, disableCustomerAuthenticator, regenerateCustomerAuthenticatorRecoveryCodes, consumeCustomerAuthenticatorRecoveryCode, revokeCustomerSessions, recordCustomerLogin, deactivateCustomerAccount, permanentlyDeleteCustomerAccount, getCustomerWatchlist, updateCustomerWatchlist } from './scanner/customer_account_store.mjs';
import crypto from 'node:crypto';
import { generateCustomerAuthenticatorSecret, verifyCustomerAuthenticatorCode } from './scanner/customer_authenticator.mjs';
import { createCustomerEmailVerification, verifyCustomerEmailToken } from './scanner/customer_email_verification.mjs';
import { appendCustomerEmailVerificationRecord, findCustomerEmailVerificationByTokenHash, markCustomerEmailVerificationConsumed } from './scanner/customer_email_verification_store.mjs';
import { deliverCustomerVerificationEmail } from './scanner/customer_verification_email_delivery.mjs';
import { createCustomerPasswordReset, verifyCustomerPasswordResetToken } from './scanner/customer_password_reset.mjs';
import { appendCustomerPasswordResetRecord, findCustomerPasswordResetByTokenHash, markCustomerPasswordResetConsumed, revokeCustomerPasswordResetsForAccount } from './scanner/customer_password_reset_store.mjs';
import { deliverCustomerPasswordResetEmail } from './scanner/customer_password_reset_email_delivery.mjs';
import { COOKIE_NAME as CUSTOMER_COOKIE_NAME, authenticateCustomer, createCustomerSessionToken, verifyCustomerSessionToken } from './scanner/customer_auth.mjs';
import { requireCustomerSameOrigin } from './scanner/customer_same_origin.mjs';
import { applyCustomerSecurityHeaders } from './scanner/customer_security_headers.mjs';
import { validateCustomerSessionSecret } from './scanner/customer_session_secret.mjs';
import { buildCustomerSessionCookieOptions, buildCustomerSessionCookieClearOptions } from './scanner/customer_session_cookie.mjs';
import { createCustomerLoginRateLimiter } from './scanner/customer_login_rate_limit.mjs';
import { createCustomerSignupRateLimiter } from './scanner/customer_signup_rate_limit.mjs';
import { createCustomerPasswordResetRateLimiter } from './scanner/customer_password_reset_rate_limit.mjs';
import { createCustomerSensitiveSettingsRateLimiter } from './scanner/customer_sensitive_settings_rate_limit.mjs';
import { appendCustomerSecurityAuditRecord } from './scanner/customer_security_audit_store.mjs';
import { listCustomerSecurityActivity } from './scanner/customer_security_activity_reader.mjs';
import { formatCustomerDate, formatCustomerDateTime } from './scanner/customer_time.mjs';
import { startMarketDataStream } from './market_data_stream.js';
import { marketDataDump } from './utils/market_data_dump.js';
import { getDiagnostics } from './diagnostics/index.js';
import { buildRuntimeHealthState, health, readiness } from './utils/health.js';
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
import { bridgeCustomerZeroFreshRankings } from './scanner/customer_zero_fresh_ranking_bridge.mjs';
import { buildCustomerScannerFreshnessDiagnostic } from './scanner/customer_scanner_freshness_diagnostic.mjs';
import { appendOpportunityFunnelAuditRecord, listOpportunityFunnelAuditRecords, listOpportunityFunnelAuditRecordsFiltered } from './scanner/opportunity_funnel_audit_store.mjs';
import { createCustomerReportBackgroundAiReviewWorker } from './scanner/customer_report_background_ai_review_worker.mjs';
import { runCustomerReportBackgroundAiReview } from './scanner/customer_report_background_ai_review_runner.mjs';
import { createPostMarketRuntimeWorker } from './scanner/post_market_runtime_worker.mjs';
import { fetchAlpacaMarketClockReadonly } from './scanner/alpaca_market_clock_readonly.mjs';
import { runStrategyObservationPersistence } from './scanner/strategy_observation_persistence_runner.mjs';
import { listCustomerReportBackgroundAiReviewRecords } from './scanner/customer_report_background_ai_review_store.mjs';
import { createRequireOperatorDashboardAuth, registerOperatorDashboardRoutes } from './operator/operator_dashboard.mjs';
import { createRequireAdminAuthorization } from './scanner/admin_authorization.mjs';
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
import { createPaperTradePositionStateAutoRefresh } from './scanner/paper_trade_position_state_auto_refresh.mjs';
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

import { buildPublicHomepage, renderPublicHomepageHtml } from "./scanner/public_homepage.mjs";

dotenv.config();
const CUSTOMER_SESSION_SECRET = validateCustomerSessionSecret(process.env.CUSTOMER_SESSION_SECRET);
const customerLoginRateLimiter = createCustomerLoginRateLimiter();


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
app.set('trust proxy', 'loopback');
app.use(applyCustomerSecurityHeaders);
app.use((req, res, next) => {
  if (String(req.hostname ?? '').toLowerCase() !== 'www.geminiscanner.net') return next();
  return res.redirect(301, `https://geminiscanner.net${req.originalUrl || '/'}`);
});

app.get('/assets/GeminiScanner-Logo.jpg', (_req, res) => {
  res.type('image/jpeg');
  res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/GeminiScanner-Logo.jpg');
});

app.get('/customer-portfolio-owned-assets.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/javascript');
  res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/customer-portfolio-owned-assets.js');
});

app.get('/assets/customer-stage1-exit-alerts.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  return res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/customer-stage1-exit-alerts.js');
});

app.get('/assets/customer-stage1-state-refresh.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  return res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/customer-stage1-state-refresh.js');
});

app.get('/assets/customer-stage1-notification-self-test.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  return res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/customer-stage1-notification-self-test.js');
});

app.get('/assets/global-theme.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/javascript').send(`(() => {
  const apply = (theme, density, reduced) => {
    const root = document.documentElement;
    if (theme === 'dark' || theme === 'light') root.dataset.gsTheme = theme;
    else delete root.dataset.gsTheme;
    if (density === 'compact') root.dataset.gsDensity = 'compact';
    else delete root.dataset.gsDensity;
    if (reduced === true || reduced === 'true') root.dataset.gsReducedMotion = 'true';
    else delete root.dataset.gsReducedMotion;
  };
  try {
    apply(localStorage.getItem('gs.theme'), localStorage.getItem('gs.density'), localStorage.getItem('gs.reducedMotion'));
  } catch (_) {}
  window.GeminiScannerTheme = { apply };
})();`);
});

app.get('/assets/customer-scanner-countdown.js', (_req, res) => {
  res.type('application/javascript');
  res.send(`(() => {
  const node = document.querySelector("[data-scan-countdown]");
  const refreshSec = Math.max(1, Number(document.body?.dataset?.refreshSec) || 30);
  const intervalMs = refreshSec * 1000;
  let reloadStarted = false;
  let observedBoundaryMs = Math.floor(Date.now() / intervalMs) * intervalMs;

  const tick = () => {
    const nowMs = Date.now();
    const currentBoundaryMs = Math.floor(nowMs / intervalMs) * intervalMs;
    const nextBoundaryMs = currentBoundaryMs + intervalMs;
    const remaining = Math.max(0, Math.ceil((nextBoundaryMs - nowMs) / 1000));

    if (node) node.textContent = String(remaining);

    if (currentBoundaryMs > observedBoundaryMs && reloadStarted === false) {
      reloadStarted = true;
      window.location.reload();
      return;
    }

    observedBoundaryMs = currentBoundaryMs;
  };

  tick();
  window.setInterval(tick, 250);
})();`);
});


app.use((_req, res, next) => {
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const contentType = String(res.getHeader('Content-Type') ?? '');
    const isHtml =
      typeof body === 'string'
      && (contentType.includes('text/html') || /<!doctype html|<html[\s>]/i.test(body));
    const alreadyUsesGlobalTheme =
      isHtml
      && (
        body.includes('class="gs-global-header"')
        || body.includes('data-gs-global-theme=')
      );

    if (isHtml && !alreadyUsesGlobalTheme) {
      return originalSend(injectGeminiScannerBrandHeader(body));
    }
    return originalSend(body);
  };
  next();
});

const underFiveSharedCachePromise = import('./scanner/alpaca_under_five_shared_scan_cache.mjs')
  .then((mod) => mod.createAlpacaUnderFiveSharedScanCache({
    scanOptions: { minPrice: 0, maxPrice: 1000 },
    onScanComplete(snapshot) {
      appendOpportunityFunnelAuditRecord({
        scanId: `under-five-${snapshot?.sharedCache?.scanCount ?? 'unknown'}-${snapshot?.sharedCache?.generatedAt ?? Date.now()}`,
        scanner: 'alpaca_under_five_shared',
        sourceVersion: snapshot?.version,
        sourceStatus: snapshot?.status,
        marketOpen: snapshot?.marketClock?.isOpen === true,
        assetCount: snapshot?.assetCount,
        snapshotCount: snapshot?.snapshotCount,
        candidateCount: snapshot?.candidateCount,
        candidates: snapshot?.candidates,
      }, {
        maxCandidates: 50,
      });
    },
  }))
  .catch((error) => {
    console.error('[under-five-shared-cache] init failed', error?.message ?? String(error));
    return null;
  });

const premarketSharedCachePromise = import('./scanner/alpaca_premarket_shared_scan_cache.mjs')
  .then(async (mod) => {
    const persistedPremarketHistory = listOpportunityFunnelAuditRecordsFiltered({
      maxRecords: 100,
      scanner: 'alpaca_premarket_shared_readonly',
      scanType: 'premarket',
    })
      .filter((record) =>
        record?.scanner === 'alpaca_premarket_shared_readonly'
        || record?.scanType === 'premarket'
      )
      .map((record) => ({
        scanId: record?.scanId ?? null,
        version: record?.sourceVersion ?? 'opportunity_funnel_audit_store_v1',
        status: record?.sourceStatus ?? 'unknown',
        generatedAt: record?.eventAt ?? null,
        candidateCount: Number(record?.candidateCount ?? 0),
        candidates: Array.isArray(record?.candidates) ? record.candidates : [],
        sharedCache: {
          version: mod.VERSION,
          generatedAt: record?.eventAt ?? null,
          scanId: record?.scanId ?? null,
          hydrated: true,
          skipped: false,
          readOnly: true,
        },
      }));
    const cache = mod.createAlpacaPremarketSharedScanCache({
      initialScanHistory: persistedPremarketHistory,
      scanOptions: {
        minPrice: 0.5,
        maxPrice: 1000,
        minDailyVolume: 100000,
        minGapPct: 2,
        minDollarVolume: 250000,
        maxSpreadPct: 2,
      },
      onScanComplete(snapshot) {
        appendOpportunityFunnelAuditRecord({
          scanId: `premarket-auto-${snapshot?.sharedCache?.scanCount ?? 'unknown'}-${snapshot?.sharedCache?.generatedAt ?? Date.now()}`,
          scanner: 'alpaca_premarket_shared_readonly',
          scanType: 'premarket',
          sourceVersion: snapshot?.version,
          sourceStatus: snapshot?.status,
          marketOpen: false,
          assetCount: snapshot?.assetCount,
          snapshotCount: snapshot?.snapshotCount,
          candidateCount: snapshot?.candidateCount,
          candidates: snapshot?.candidates,
        });
      },
    });
    await cache.start();
    return cache;
  })
  .catch((error) => {
    console.error('[premarket-shared-cache] init failed', error?.message ?? String(error));
    return null;
  });

function readUnderFiveLiveRankings(source = {}) {
  const rows = Array.isArray(source?.candidates) ? source.candidates : [];
  return readScannerRankings({
    rows,
    nowMs: Date.now(),
  });
}

async function getUnderFiveSharedSource({ refresh = false } = {}) {
  const cache = await underFiveSharedCachePromise;
  if (!cache) throw new Error('under_five_shared_cache_unavailable');
  cache.noteDemand?.();
  const current = cache.getLatest();
  const source = refresh || !current || current?.idleNoDemand === true
    ? await cache.refreshNow()
    : current;
  return bridgeCustomerZeroFreshRankings(source, readUnderFiveLiveRankings(source), getStreamTelemetry());
}

async function getPremarketSharedSource({ refresh = false, maxPrice = 1000 } = {}) {
  const cache = await premarketSharedCachePromise;
  if (!cache) throw new Error('premarket_shared_cache_unavailable');
  const latest = cache.getLatest();
  if (latest && Number(latest?.filters?.maxPrice) === Number(maxPrice) && !refresh) return latest;
  return cache.refreshNow();
}

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



app.get('/app/paper-automatic-disabled-summary-review', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_summary_review_app_screen.mjs');
    const screen = await mod.buildPaperAutomaticDisabledSummaryReviewAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledSummaryReviewAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-summary', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_summary_app_screen.mjs');
    const screen = await mod.buildPaperAutomaticDisabledSummaryAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledSummaryAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-operator-preview-review', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_operator_preview_review_app_screen.mjs');
    const screen = await mod.buildPaperAutomaticDisabledOperatorPreviewReviewAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledOperatorPreviewReviewAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-operator-preview', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_operator_preview_app_screen.mjs');
    const screen = await mod.buildPaperAutomaticDisabledOperatorPreviewAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledOperatorPreviewAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-chain', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_chain_app_screen.mjs');
    const screen = await mod.buildPaperAutomaticDisabledChainAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledChainAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-review', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_review_app_screen.mjs');
    const screen = mod.buildPaperAutomaticDisabledReviewAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledReviewAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-automatic-disabled-preview', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_automatic_disabled_app_screen.mjs');
    const screen = mod.buildPaperAutomaticDisabledAppScreen();
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperAutomaticDisabledAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
});

app.get('/app/paper-user-approved-disabled-approval-review', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_user_approved_disabled_approval_review_app_screen.mjs');
    const screen = await mod.buildPaperUserApprovedDisabledApprovalReviewAppScreen();
    res.type('html').send(mod.renderPaperUserApprovedDisabledApprovalReviewAppScreenHtml(screen));
  } catch {
    res.status(500).json({ error: 'paper_user_approved_disabled_approval_review_unavailable' });
  }
});

app.get('/app/paper-user-approved-disabled-preview', async (_req, res) => {
  try {
    const mod = await import('./scanner/paper_user_approved_disabled_app_screen.mjs');
    const screen = await mod.buildPaperUserApprovedDisabledAppScreen({});
    res.set('Cache-Control', 'no-store');
    res.status(200).type('html').send(mod.renderPaperUserApprovedDisabledAppScreenHtml(screen));
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message ?? String(error) });
  }
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
app.use(express.urlencoded({ extended: false, limit: '16kb' }));

const P3_ENABLED = process.env.P3_ENABLED === '1';

// --------------------
// Health / Readiness / Diagnostics / Marketdata / Runlog
// --------------------
app.get('/signup', (_req, res) => {
  const accountCreationEnabled = process.env.CUSTOMER_SIGNUP_ENABLED === '1';
  const signup = buildCustomerSignupPage({
    accountCreationEnabled,
    securityNote: accountCreationEnabled
      ? "Your account will be created in pending email-verification status."
      : "Registration is temporarily unavailable.",
  });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderCustomerSignupPageHtml(signup));
});

const customerSignupRateLimiter = createCustomerSignupRateLimiter();

app.post('/signup', requireCustomerSameOrigin, async (req, res) => {
  res.set('Cache-Control', 'no-store');

  if (customerSignupRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many attempts</h1><p>Please wait before trying again.</p><p><a href="/signup">Return to signup</a></p></main></body></html>',
    );
  }

  if (process.env.CUSTOMER_SIGNUP_ENABLED !== '1') {
    recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'signup_disabled');
    return res.status(503).type('html').send(
      '<!doctype html><html><body><main><h1>Signup unavailable</h1><p>Registration is temporarily disabled.</p><p><a href="/signup">Return to signup</a></p></main></body></html>',
    );
  }

  if (
    String(process.env.CUSTOMER_EMAIL_PROVIDER ?? '').trim().toLowerCase() !== 'resend'
    || !String(process.env.RESEND_API_KEY ?? '').trim()
    || !String(process.env.CUSTOMER_EMAIL_FROM ?? '').trim()
  ) {
    recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'email_delivery_unavailable');
    return res.status(503).type('html').send(
      '<!doctype html><html><body><main><h1>Signup temporarily unavailable</h1><p>Email verification delivery is not configured yet.</p><p><a href="/signup">Return to signup</a></p></main></body></html>',
    );
  }

  try {
    const existingAccount = findCustomerAccountByEmail(req.body?.email);
    if (existingAccount) {
      recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'account_already_exists', existingAccount.id);
      return res.status(409).type('html').send(
        renderThemedStatusPage({ title: 'Account already exists', message: 'Use the sign-in or password-recovery flow for this email.', href: '/login', linkLabel: 'Sign in' }),
      );
    }

    const record = createCustomerAccountRecord(req.body);
    appendCustomerAccountRecord(record);

    const verification = createCustomerEmailVerification(record);
    appendCustomerEmailVerificationRecord(verification.record);

    const delivery = await deliverCustomerVerificationEmail({
      email: record.email,
      token: verification.token,
    });

    if (!delivery.ok) {
      recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'verification_delivery_failed', record.id);
      return res.status(503).type('html').send(
        renderThemedStatusPage({ title: 'Verification email delayed', message: 'Your account is pending verification, but the email could not be delivered. Please contact GeminiScanner support.' }),
      );
    }

    recordCustomerSecurityAudit(req, 'signup_created', 'success', undefined, record.id);
    return res.status(201).type('html').send(
      renderThemedStatusPage({ title: 'Check your email', message: 'Your GeminiScanner customer account was created. Open the verification link sent to your email address.' }),
    );
  } catch (error) {
    recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'invalid_signup');
    const codes = Array.isArray(error?.codes) ? error.codes.join(', ') : 'invalid_signup';
    return res.status(400).type('html').send(
      renderThemedStatusPage({ title: 'Signup needs attention', message: codes, href: '/signup', linkLabel: 'Return to signup' }),
    );
  }
});

app.get('/verify-email', (req, res) => {
  res.set('Cache-Control', 'no-store');

  const token = String(req.query?.token ?? '').trim();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const verificationRecord = findCustomerEmailVerificationByTokenHash(tokenHash);
  const result = verifyCustomerEmailToken(token, verificationRecord ?? {});

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'email_verification', 'failure', 'invalid_or_expired_token');
    return res.status(400).type('html').send(
      renderThemedStatusPage({ title: 'Verification link unavailable', message: 'This email verification link is invalid, expired, or already used.', href: '/signup', linkLabel: 'Return to signup' }),
    );
  }

  const account = findCustomerAccountById(result.accountId);
  const isEmailChange = Boolean(
    account?.pendingEmail
    && String(account.pendingEmail).trim().toLowerCase() === String(result.email).trim().toLowerCase()
  );
  const accountResult = isEmailChange
    ? completeCustomerEmailChange(result.accountId, result.email)
    : markCustomerEmailVerified(result.accountId);
  if (!accountResult.ok) {
    recordCustomerSecurityAudit(req, 'email_verification', 'failure', 'account_update_failed', result.accountId);
    return res.status(400).type('html').send(
      renderThemedStatusPage({ title: 'Verification could not be completed', message: 'Please contact GeminiScanner support.' }),
    );
  }

  markCustomerEmailVerificationConsumed(verificationRecord.tokenHash);
  recordCustomerSecurityAudit(
    req,
    isEmailChange ? 'email_change_verified' : 'email_verified',
    'success',
    undefined,
    result.accountId,
  );

  return res.status(200).type('html').send(
    isEmailChange
      ? renderThemedStatusPage({ title: 'Email address changed', message: 'Your new email address is verified. Sign in again with the new address.', href: '/login', linkLabel: 'Continue to sign in' })
      : '<!doctype html><html><body><main><h1>Email verified</h1><p>Your GeminiScanner customer account is now active.</p><p><a href="/login">Continue to sign in</a></p></main></body></html>',
  );
});


function customerCookieValue(req) {
  const raw = String(req.headers?.cookie ?? '');
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === CUSTOMER_COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function customerLoginHtml(message = '') {
  const notice = message
    ? `<div class="notice" role="alert">${String(message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Customer sign in</title>
${renderGlobalThemeCss({ surface: 'public' })}
<style>
main{min-height:calc(100vh - 132px);display:grid;place-items:center;padding:34px 18px 64px}
.auth-card{width:min(100%,460px);padding:28px}
.eyebrow{margin:0 0 8px;color:var(--gs-accent);font-size:12px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}
h1{margin:0 0 8px;font-size:clamp(32px,8vw,46px);line-height:1.05;letter-spacing:-.035em}
.sub{margin:0 0 24px;color:var(--gs-muted);line-height:1.55}
form{display:grid;gap:16px}
label{display:grid;gap:8px;font-weight:800}
button{width:100%;padding:14px 18px}
.links{margin:20px 0 0;text-align:center;color:var(--gs-muted)}
.links a{font-weight:800;text-decoration:none}
.notice{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(255,65,84,.55);border-radius:12px;background:rgba(91,12,24,.42);color:#ffd8dd}
</style>
</head>
<body data-gs-page="customer-login">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'public', homeHref: '/', label: 'GeminiScanner' })}
<main>
<section class="card auth-card">
<p class="eyebrow">GeminiScanner customer portal</p>
<h1>Sign in</h1>
<p class="sub">Access your scanner, watchlist, and account settings.</p>
${notice}
<form method="post" action="/login">
<label>Email
<input name="email" type="email" autocomplete="email" inputmode="email" required>
</label>
<label>Password
<input name="password" type="password" autocomplete="current-password" required>
</label>
<label>Authenticator code
<input name="authenticatorCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6">
</label>
<label>Recovery code
<input name="authenticatorRecoveryCode" type="text" autocomplete="one-time-code" maxlength="11" placeholder="ABCDE-12345">
</label>
<button type="submit">Sign in</button>
</form>
<p class="links"><a href="/forgot-password">Forgot password?</a></p>
<p class="links">New to GeminiScanner? <a href="/signup">Create an account</a></p>
</section>
</main>
${renderGlobalFooter()}
<script src="/customer/assets/password-visibility.js" defer></script>
</body>
</html>`;
}

function requireCustomerSession(req, res, next) {
  const secret = CUSTOMER_SESSION_SECRET
  const result = verifyCustomerSessionToken(customerCookieValue(req), {
    secret,
    authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  });
  if (!result.ok) return res.redirect(303, '/login');
  req.customerAccount = result.account;
  return next();
}

app.get('/login', (req, res) => {
  const secret = CUSTOMER_SESSION_SECRET
  const current = verifyCustomerSessionToken(customerCookieValue(req), {
    secret,
    authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  });
  if (current.ok) return res.redirect(303, '/customer');
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(customerLoginHtml());
});

app.post('/login', requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (customerLoginRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'login_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(customerLoginHtml('Too many sign-in attempts. Try again later.'));
  }
  const result = authenticateCustomer(
    req.body?.email,
    req.body?.password,
    {
      authenticatorCode: req.body?.authenticatorCode,
      authenticatorRecoveryCode: req.body?.authenticatorRecoveryCode,
      authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
      verifyAuthenticatorCode: verifyCustomerAuthenticatorCode,
      consumeAuthenticatorRecoveryCode: consumeCustomerAuthenticatorRecoveryCode,
    },
  );
  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'login_attempt', 'failure', result.reason);
    const message = result.reason === 'authenticator_required'
      ? 'Enter the current six-digit code from your authenticator app.'
      : 'Email or password is incorrect, or the account is not verified.';
    return res.status(401).type('html').send(customerLoginHtml(message));
  }
  const secret = CUSTOMER_SESSION_SECRET
  const loginRecord = recordCustomerLogin(
    result.account.id,
    {
      ip: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    },
    {
      authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
    },
  );
  if (!loginRecord.ok) {
    recordCustomerSecurityAudit(req, 'login_attempt', 'failure', loginRecord.reason, result.account.id);
    return res.status(503).type('html').send(customerLoginHtml('Customer sign-in is temporarily unavailable.'));
  }
  recordCustomerSecurityAudit(req, 'login_success', 'success', undefined, loginRecord.account.id);
  customerLoginRateLimiter.clear(req);
  const token = createCustomerSessionToken(loginRecord.account, { secret });
  res.cookie(CUSTOMER_COOKIE_NAME, token, buildCustomerSessionCookieOptions());
  return res.redirect(303, '/customer');
});


const customerPasswordResetRateLimiter = createCustomerPasswordResetRateLimiter();
const customerSensitiveSettingsRateLimiter = createCustomerSensitiveSettingsRateLimiter();

function recordCustomerSecurityAudit(req, eventType, outcome, reason, accountId) {
  appendCustomerSecurityAuditRecord({
    eventType,
    outcome,
    reason,
    accountId: accountId ?? req.customerAccount?.id,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  });
}

function customerForgotPasswordHtml(message = '') {
  const notice = message
    ? `<div class="notice" role="status">${String(message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset password</title>
${renderGlobalThemeCss({ surface: 'public' })}
<style>
main{min-height:calc(100vh - 132px);display:grid;place-items:center;padding:34px 18px 64px}
.auth-card{width:min(100%,500px);padding:28px}
h1{margin:0 0 10px;font-size:clamp(32px,8vw,46px);letter-spacing:-.035em}
.sub{margin:0 0 24px;color:var(--gs-muted);line-height:1.55}
form{display:grid;gap:16px}
label{display:grid;gap:8px;font-weight:800}
button{width:100%;padding:14px 18px}
.links{margin:20px 0 0;text-align:center}
.notice{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(64,255,198,.45);border-radius:12px;background:rgba(5,84,64,.34);color:#caffef}
</style>
</head>
<body data-gs-page="customer-forgot-password">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'public', homeHref: '/', label: 'GeminiScanner' })}
<main>
<section class="card auth-card">
<h1>Reset password</h1>
<p class="sub">Enter your customer email address.</p>
${notice}
<form method="post" action="/forgot-password">
<label>Email
<input name="email" type="email" autocomplete="email" required>
</label>
<button type="submit">Send reset link</button>
</form>
<p class="links"><a href="/login">Return to sign in</a></p>
</section>
</main>
${renderGlobalFooter()}
</body>
</html>`;
}

function customerResetPasswordHtml(token, message = '') {
  const safeToken = String(token ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const notice = message
    ? `<div class="notice" role="alert">${String(message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Choose new password</title>
${renderGlobalThemeCss({ surface: 'public' })}
<style>
main{min-height:calc(100vh - 132px);display:grid;place-items:center;padding:34px 18px 64px}
.auth-card{width:min(100%,500px);padding:28px}
h1{margin:0 0 20px;font-size:clamp(32px,8vw,46px);letter-spacing:-.035em}
form{display:grid;gap:16px}
label{display:grid;gap:8px;font-weight:800}
button{width:100%;padding:14px 18px}
.links{margin:20px 0 0;text-align:center}
.notice{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(255,65,84,.55);border-radius:12px;background:rgba(91,12,24,.42);color:#ffd8dd}
</style>
</head>
<body data-gs-page="customer-reset-password">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'public', homeHref: '/', label: 'GeminiScanner' })}
<main>
<section class="card auth-card">
<h1>Choose new password</h1>
${notice}
<form method="post" action="/reset-password">
<input name="token" type="hidden" value="${safeToken}">
<label>New password
<input name="newPassword" type="password" minlength="12" autocomplete="new-password" required>
</label>
<label>Confirm new password
<input name="confirmPassword" type="password" minlength="12" autocomplete="new-password" required>
</label>
<button type="submit">Reset password</button>
</form>
<p class="links"><a href="/login">Return to sign in</a></p>
</section>
</main>
${renderGlobalFooter()}
<script src="/customer/assets/password-visibility.js" defer></script>
</body>
</html>`;
}

app.get('/forgot-password', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(customerForgotPasswordHtml());
});

app.post('/forgot-password', requireCustomerSameOrigin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (customerPasswordResetRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'password_reset_request', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(customerForgotPasswordHtml('Please wait before trying again.'));
  }

  const genericMessage = 'If that email belongs to an active account, a password reset link has been sent.';
  const account = findCustomerAccountByEmail(req.body?.email);
  if (!account || account.emailVerified !== true || account.status !== 'active') {
    recordCustomerSecurityAudit(req, 'password_reset_request', 'failure', 'account_unavailable');
    return res.status(200).type('html').send(customerForgotPasswordHtml(genericMessage));
  }

  const reset = createCustomerPasswordReset(account);
  appendCustomerPasswordResetRecord(reset.record);
  const delivery = await deliverCustomerPasswordResetEmail({
    email: account.email,
    token: reset.token,
  });

  if (!delivery.ok) {
    recordCustomerSecurityAudit(req, 'password_reset_request', 'failure', 'delivery_failed', account.id);
    markCustomerPasswordResetConsumed(reset.record.tokenHash);
    console.error('[customer-password-reset] delivery_failed');
  } else {
    recordCustomerSecurityAudit(req, 'password_reset_requested', 'success', undefined, account.id);
    revokeCustomerPasswordResetsForAccount(account.id, {
      excludeTokenHash: reset.record.tokenHash,
    });
  }

  return res.status(200).type('html').send(customerForgotPasswordHtml(genericMessage));
});

app.get('/reset-password', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.query?.token ?? '').trim();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = findCustomerPasswordResetByTokenHash(tokenHash);
  const result = verifyCustomerPasswordResetToken(token, record ?? {});
  if (!result.ok) {
    return res.status(400).type('html').send(customerResetPasswordHtml('', 'This password reset link is invalid, expired, or already used.'));
  }
  return res.status(200).type('html').send(customerResetPasswordHtml(token));
});

app.post('/reset-password', requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  const token = String(req.body?.token ?? '').trim();
  const newPassword = String(req.body?.newPassword ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');

  if (newPassword !== confirmPassword) {
    recordCustomerSecurityAudit(req, 'password_reset', 'failure', 'password_confirmation_mismatch');
    return res.status(400).type('html').send(customerResetPasswordHtml(token, 'New password and confirmation do not match.'));
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = findCustomerPasswordResetByTokenHash(tokenHash);
  const verified = verifyCustomerPasswordResetToken(token, record ?? {});
  if (!verified.ok) {
    recordCustomerSecurityAudit(req, 'password_reset', 'failure', 'invalid_or_expired_token');
    return res.status(400).type('html').send(customerResetPasswordHtml('', 'This password reset link is invalid, expired, or already used.'));
  }

  const changed = resetCustomerPassword(verified.accountId, newPassword);
  if (!changed.ok) {
    recordCustomerSecurityAudit(req, 'password_reset', 'failure', changed.reason ?? 'password_reset_failed', verified.accountId);
    const message = changed.reason === 'new_password_too_short'
      ? 'New password must be at least 12 characters.'
      : changed.reason === 'new_password_must_differ'
        ? 'New password must differ from the current password.'
        : 'Password could not be reset.';
    return res.status(400).type('html').send(customerResetPasswordHtml(token, message));
  }

  recordCustomerSecurityAudit(req, 'password_reset', 'success', undefined, verified.accountId);
  markCustomerPasswordResetConsumed(record.tokenHash);
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.status(200).type('html').send(
    '<!doctype html><html><body><main><h1>Password reset complete</h1><p>Your password has been updated. Sign in with your new password.</p><p><a href="/login">Continue to sign in</a></p></main></body></html>',
  );
});

app.post('/logout', requireCustomerSameOrigin, (req, res) => {
  recordCustomerSecurityAudit(req, 'logout', 'success');
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.redirect(303, '/login');
});

app.get('/', (_req, res) => {
  const homepage = buildPublicHomepage();
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderPublicHomepageHtml(homepage));
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
app.get('/diagnostics/alpaca-under-five-shared-cache', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const cache = await underFiveSharedCachePromise;
  const diagnostics = cache?.getDiagnostics?.() ?? null;
  res.json({
    ok: diagnostics !== null,
    diagnostics,
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
});

app.get('/diagnostics/customer-scanner-freshness', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const cache = await underFiveSharedCachePromise;
    const cacheDiagnostics = cache?.getDiagnostics?.() ?? null;
    const latestSource = cache?.getLatest?.() ?? null;
    res.json(buildCustomerScannerFreshnessDiagnostic({
      cacheDiagnostics,
      rankingRoot: readUnderFiveLiveRankings(latestSource),
      streamTelemetry: getStreamTelemetry(),
    }));
  } catch (err) {
    res.status(500).json({ ok: false, error: 'CUSTOMER_SCANNER_FRESHNESS_DIAGNOSTIC_FAILED', message: err?.message ?? String(err), readOnly: true, orderPlacementAllowed: false, brokerContactAllowed: false, accountMutationAllowed: false });
  }
});

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
const requireAdminAuthorization = createRequireAdminAuthorization();

app.get('/admin', requireAdminAuthorization, async (_req, res) => {
  const mod = await import('./scanner/admin_surface.mjs');
  const surface = mod.buildAdminSurface();
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderAdminSurfaceHtml(surface));
});



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

app.get("/diagnostics/opportunity-audit-archive-retention-preview", (req, res) => {
  const screen = buildRetentionCleanupAppScreen({
    source: "opportunity_audit",
    limit: req.query.limit,
    retentionDays: req.query.retentionDays,
    maxArchives: req.query.maxArchives,
    maxTotalBytes: req.query.maxTotalBytes,
    autoRefreshEnabled: false,
  });
  res.json(screen);
});

app.get("/app/opportunity-audit-archive-retention", (req, res) => {
  const screen = buildRetentionCleanupAppScreen({
    source: "opportunity_audit",
    limit: req.query.limit,
    retentionDays: req.query.retentionDays,
    maxArchives: req.query.maxArchives,
    maxTotalBytes: req.query.maxTotalBytes,
    autoRefreshEnabled: false,
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

app.get("/diagnostics/post-market-runtime", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(postMarketRuntimeWorker.getStatus());
});

app.get("/diagnostics/customer-report-background-ai-review", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    worker: customerReportBackgroundAiReviewWorker.getStatus(),
    history: listCustomerReportBackgroundAiReviewRecords({ maxRecords: 20 }),
    readOnly: true,
    paperOnly: true,
    automaticLearningAllowed: false,
    scannerLogicMutationAllowed: false,
    thresholdMutationAllowed: false,
    orderPlacementAllowed: false,
    brokerContactAllowed: false,
    accountMutationAllowed: false,
  });
});

app.get("/diagnostics/app-navigation-readonly", (req, res) => {
  res.json(buildAppNavigationReadonly({ now: new Date() }));
});

app.get("/app", (req, res) => {
  res.type("html").send(renderAppNavigationReadonlyHtml(buildAppNavigationReadonly({ now: new Date() })));
});


const paperPositionStateAutoRefresh = createPaperTradePositionStateAutoRefresh();

const customerReportBackgroundAiReviewWorker = createCustomerReportBackgroundAiReviewWorker({
  runReview: ({ now } = {}) => runCustomerReportBackgroundAiReview({
    now,
    getPostMarketResult: () => postMarketRuntimeWorker.getStatus().lastResult,
  }),
});

const postMarketRuntimeWorker = createPostMarketRuntimeWorker({
  getMarketClock: async () => {
    const source = await fetchAlpacaMarketClockReadonly();
    return source?.marketClock ?? {};
  },
  afterCycle: async ({ now } = {}) => {
    const strategyObservationPersistence = runStrategyObservationPersistence({
      now,
      persist: true,
    });

    const appendedCount = Number(strategyObservationPersistence?.appendedCount ?? 0);
    const backgroundAiReview = appendedCount > 0
      ? await customerReportBackgroundAiReviewWorker.runNow()
      : Object.freeze({
          status: "no_strategy_observation_changes",
          triggered: false,
          readOnly: true,
          paperOnly: true,
          automaticLearningAllowed: false,
          scannerLogicMutationAllowed: false,
          thresholdMutationAllowed: false,
          orderPlacementAllowed: false,
          brokerContactAllowed: false,
          accountMutationAllowed: false,
        });

    return Object.freeze({
      ...strategyObservationPersistence,
      backgroundAiReviewTriggered: appendedCount > 0,
      backgroundAiReview,
    });
  },
});

app.listen(PORT, HOST, async () => {
  const underFiveCache = await underFiveSharedCachePromise;
  if (underFiveCache) {
    underFiveCache.start().catch((error) => {
      console.error('[under-five-shared-cache] start failed', error?.message ?? String(error));
    });
  }
  console.log(`[server] listening on http://${HOST}:${PORT}`);
  const postMarketRuntimeStatus = postMarketRuntimeWorker.start();
  console.log('[postmarket-runtime] worker status', {
    enabled: postMarketRuntimeStatus.enabled,
    running: postMarketRuntimeStatus.running,
    timerScheduled: postMarketRuntimeStatus.timerScheduled,
    lastStatus: postMarketRuntimeStatus.lastStatus,
  });
  const backgroundAiReviewStatus = customerReportBackgroundAiReviewWorker.start();
  console.log('[background-ai-review] worker status', {
    enabled: backgroundAiReviewStatus.enabled,
    running: backgroundAiReviewStatus.running,
    intervalMs: backgroundAiReviewStatus.intervalMs,
    lastStatus: backgroundAiReviewStatus.lastStatus,
  });
  const paperPositionRefresh = paperPositionStateAutoRefresh.start();
  console.log('[paper-position-auto-refresh] started', {
    intervalMs: paperPositionRefresh.intervalMs,
    status: paperPositionRefresh.lastStatus
  });
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

app.get('/diagnostics/paper-trade-position-state-auto-refresh', (_req, res) => {
  res.json(paperPositionStateAutoRefresh.diagnostics());
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
    const viewMod = await import('./scanner/alpaca_under_five_universe_app_card.mjs');
    const source = await getUnderFiveSharedSource();
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
    const viewMod = await import('./scanner/alpaca_under_five_universe_app_card.mjs');
    const source = await getUnderFiveSharedSource();
    const card = viewMod.buildAlpacaUnderFiveUniverseAppCard(source, {
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now: new Date(),
    });
    res.type('html').send(viewMod.renderAlpacaUnderFiveUniverseAppCardHtml(card));
  } catch (err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Under $5 Read-Only Potential</h1><p>Unavailable.</p><p>No execution controls.</p></body></html>');
  }
});


app.get('/customer', requireCustomerSession, async (req, res) => {
  const mod = await import('./scanner/customer_scanner_hub.mjs');
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
  const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');
  const performanceMod = await import('./scanner/customer_zero_performance_report.mjs');
  const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
  const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
  const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
  const paperLedger = paperPositionLedger.latestRecord ?? {};
  const performanceReport = performanceMod.buildCustomerZeroPerformanceReport({
    period: req.query.period ?? "lifetime",
    sourceTs: paperLedger.lastUpdatedAt ?? paperLedger.createdAt ?? null,
    paperAccount,
    paperLedger,
    paperLedgerHistory: paperPositionLedger.records,
    now: new Date(),
  });
  const hub = mod.buildCustomerScannerHub({ performanceReport });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderCustomerScannerHubHtml(hub, req.customerAccount));
});


async function buildCurrentCustomerStage1EvidenceExport() {
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const exportMod = await import('./scanner/customer_stage1_evidence_export.mjs');
  const statusPath = process.env.PAPER_MANUAL_WATCH_STATUS_PATH ?? path.join(process.cwd(), 'runs', 'paper_manual_round_trip_status.json');
  let status = null;
  try { status = JSON.parse(fs.readFileSync(statusPath, 'utf8')); } catch {}
  const snapshot = await accountData.fetchAlpacaPaperAccountReadonly();
  const generatedAt = status?.promotionProof?.completedAt ?? status?.generatedAt ?? status?.updatedAt ?? new Date().toISOString();
  return { exportMod, record: exportMod.buildCustomerStage1EvidenceExport({ status, snapshot, generatedAt }) };
}

app.get('/customer/stage1/evidence.json', requireCustomerSession, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { exportMod, record } = await buildCurrentCustomerStage1EvidenceExport();
    if (record.exportReady !== true) return res.status(409).type('application/json').send(exportMod.serializeCustomerStage1EvidenceExportJson(record));
    const safeId = String(record.evidenceId ?? 'complete').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'complete';
    res.set('Content-Disposition', `attachment; filename="geminiscanner-stage1-evidence-${safeId}.json"`);
    return res.type('application/json').send(exportMod.serializeCustomerStage1EvidenceExportJson(record));
  } catch {
    return res.status(503).type('application/json').send(JSON.stringify({ verdict: 'PENDING', exportReady: false, issues: ['stage1_status_or_snapshot_unavailable'] }, null, 2) + '\n');
  }
});

app.get('/customer/stage1/evidence.txt', requireCustomerSession, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { exportMod, record } = await buildCurrentCustomerStage1EvidenceExport();
    if (record.exportReady !== true) return res.status(409).type('text/plain').send(exportMod.renderCustomerStage1EvidenceExportText(record));
    const safeId = String(record.evidenceId ?? 'complete').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'complete';
    res.set('Content-Disposition', `attachment; filename="geminiscanner-stage1-report-${safeId}.txt"`);
    return res.type('text/plain').send(exportMod.renderCustomerStage1EvidenceExportText(record));
  } catch {
    return res.status(503).type('text/plain').send('GeminiScanner Stage 1 Mechanical Evidence Export\nVerdict: PENDING\nIssues: stage1_status_or_snapshot_unavailable\n');
  }
});


app.get('/customer/portfolio', requireCustomerSession, async (req, res) => {
  try {
    const portfolioModelMod = await import('./scanner/customer_portfolio_model.mjs');
    const portfolioPageMod = await import('./scanner/customer_portfolio_page.mjs');
    const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const ownedAssetStore = await import('./scanner/customer_owned_asset_store.mjs');
    const windDownPolicy = await import('./scanner/customer_portfolio_wind_down_policy.mjs');
    const stage1MondayChecklistMod = await import('./scanner/customer_stage1_monday_checklist_panel.mjs');
    const stage1MondayLiveControlMod = await import('./scanner/customer_stage1_monday_live_control_panel.mjs');
    const stage1EventTimelineMod = await import('./scanner/customer_stage1_event_timeline_panel.mjs');
    const stage1LiveIncidentMod = await import('./scanner/customer_stage1_live_incident_panel.mjs');
    const stage1NotificationSelfTestMod = await import('./scanner/customer_stage1_notification_self_test_panel.mjs');
    const stage1OperatorConsoleMod = await import('./scanner/customer_stage1_operator_console.mjs');
    const stage1DetectionLatencyMod = await import('./scanner/customer_stage1_detection_latency_panel.mjs');
    const stage1PanelMod = await import('./scanner/customer_stage1_manual_trade_panel.mjs');
    const stage1ReconciliationMod = await import('./scanner/customer_stage1_reconciliation_panel.mjs');
    const stage1ExitAlertMod = await import('./scanner/customer_stage1_exit_alert_panel.mjs');
    const stage1CompletionRecordMod = await import('./scanner/customer_stage1_completion_record_panel.mjs');
    const stage1PostTradeReviewMod = await import('./scanner/customer_stage1_post_trade_review_panel.mjs');
    const stage1EvidenceExportMod = await import('./scanner/customer_stage1_evidence_export.mjs');
    const stage1EvidenceDownloadMod = await import('./scanner/customer_stage1_evidence_download_panel.mjs');

    const now = new Date();
    const rawFetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
    const fetchedPaperAccount = rawFetchedPaperAccount?.status === 'connected_readonly'
      && Array.isArray(rawFetchedPaperAccount?.positions)
      && Array.isArray(rawFetchedPaperAccount?.openOrders)
      && !rawFetchedPaperAccount?.observedAt
        ? { ...rawFetchedPaperAccount, observedAt: now.toISOString() }
        : rawFetchedPaperAccount;
    const brokerPaperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
    const ownedAssets = ownedAssetStore.getCustomerOwnedAssets(req.customerAccount?.id);
    const paperAccount = brokerPaperAccount?.positions?.length
      ? brokerPaperAccount
      : { ...brokerPaperAccount, accountHealthy: ownedAssets.positions.length > 0, positions: ownedAssets.positions };
    const windDown = windDownPolicy.buildCustomerPortfolioWindDown({
      exitAllRequested: req.customerAccount?.portfolioWindDownRequested === true,
      positions: paperAccount.positions,
    });
    const model = portfolioModelMod.buildCustomerPortfolioModel({
      paperAccount,
      sourceTs: now.toISOString(),
      now,
    });
    const stage1StatusPath = process.env.PAPER_MANUAL_WATCH_STATUS_PATH ?? path.join(process.cwd(), 'runs', 'paper_manual_round_trip_status.json');
    let stage1Status = null;
    try { stage1Status = JSON.parse(fs.readFileSync(stage1StatusPath, 'utf8')); } catch {}
    const stage1RuntimeHealth = buildRuntimeHealthState();
    const stage1MarketOpen = stage1RuntimeHealth.stream?.marketOpen === true;
    const stage1MondayLiveControl = stage1MondayLiveControlMod.buildCustomerStage1MondayLiveControlPanel({
      status: stage1Status,
      snapshot: fetchedPaperAccount,
      health: { status: 'ok', ...stage1RuntimeHealth },
      readiness: { ready: stage1RuntimeHealth.degraded !== true, ...stage1RuntimeHealth },
      marketOpen: stage1MarketOpen,
      nowMs: now.getTime(),
    });
    const stage1EventTimeline = stage1EventTimelineMod.buildCustomerStage1EventTimelinePanel({ status: stage1Status });
    const stage1NotificationSelfTest = stage1NotificationSelfTestMod.buildCustomerStage1NotificationSelfTestPanel();
    const stage1MondayChecklist = stage1MondayChecklistMod.buildCustomerStage1MondayChecklistPanel({
      status: stage1Status,
      snapshot: fetchedPaperAccount,
      health: { status: 'ok', ...stage1RuntimeHealth },
      readiness: { ready: stage1RuntimeHealth.degraded !== true, ...stage1RuntimeHealth },
      watcherOnline: stage1Status?.ok === true,
      marketOpen: stage1MarketOpen,
      nowMs: now.getTime(),
    });
    const stage1OperatorConsole = stage1OperatorConsoleMod.buildCustomerStage1OperatorConsole({ status: stage1Status, snapshot: fetchedPaperAccount, marketOpen: stage1MarketOpen, nowMs: now.getTime() });
    const stage1LiveIncident = stage1LiveIncidentMod.buildCustomerStage1LiveIncidentPanel({ status: stage1Status, timeline: stage1EventTimeline, checklist: stage1MondayChecklist, operatorConsole: stage1OperatorConsole, capturedAt: now.toISOString() });
    const stage1DetectionLatency = stage1DetectionLatencyMod.buildCustomerStage1DetectionLatencyPanel({ status: stage1Status });
    const stage1Panel = stage1PanelMod.buildCustomerStage1ManualTradePanel({ status: stage1Status, marketOpen: stage1MarketOpen, nowMs: now.getTime() });
    const stage1Reconciliation = stage1ReconciliationMod.buildCustomerStage1ReconciliationPanel({ status: stage1Status });
    const stage1ExitAlert = stage1ExitAlertMod.buildCustomerStage1ExitAlertPanel({ status: stage1Status });
    const stage1CompletionRecord = stage1CompletionRecordMod.buildCustomerStage1CompletionRecordPanel({ status: stage1Status });
    const stage1PostTradeReview = stage1PostTradeReviewMod.buildCustomerStage1PostTradeReviewPanel({ tracker: stage1Status?.tracker, proof: stage1Status?.promotionProof });
    const stage1EvidenceGeneratedAt = stage1Status?.promotionProof?.completedAt ?? stage1Status?.generatedAt ?? stage1Status?.updatedAt ?? now.toISOString();
    const stage1EvidenceExport = stage1EvidenceExportMod.buildCustomerStage1EvidenceExport({ status: stage1Status, snapshot: fetchedPaperAccount, generatedAt: stage1EvidenceGeneratedAt });
    const stage1EvidenceDownload = stage1EvidenceDownloadMod.buildCustomerStage1EvidenceDownloadPanel({ record: stage1EvidenceExport });
    const stage1StateKey = JSON.stringify({
      status: stage1Status?.tracker?.status ?? null,
      symbol: stage1Status?.tracker?.symbol ?? null,
      enterDetected: stage1Status?.tracker?.enterDetected === true,
      enterReconciled: stage1Status?.tracker?.enterReconciled === true,
      exitDetected: stage1Status?.tracker?.exitDetected === true,
      exitReconciled: stage1Status?.tracker?.exitReconciled === true,
      mechanicalSuccess: stage1Status?.tracker?.mechanicalSuccess === true,
      evidenceId: stage1Status?.promotionProof?.evidenceId ?? null,
    });
    const page = portfolioPageMod.buildCustomerPortfolioPage({
      model,
      account: req.customerAccount,
      ownedAssets,
      connectedPositions: brokerPaperAccount.positions,
      brokerConnected: brokerPaperAccount.connected === true,
      windDown,
      saved: req.query?.saved === "1",
      windDownUpdated: req.query?.windDown === "1",
      stage1MondayLiveControlHtml: stage1MondayLiveControlMod.renderCustomerStage1MondayLiveControlPanelHtml(stage1MondayLiveControl),
      stage1EventTimelineHtml: stage1EventTimelineMod.renderCustomerStage1EventTimelinePanelHtml(stage1EventTimeline),
      stage1LiveIncidentHtml: stage1LiveIncidentMod.renderCustomerStage1LiveIncidentPanelHtml(stage1LiveIncident),
      stage1MondayChecklistHtml: stage1MondayChecklistMod.renderCustomerStage1MondayChecklistPanelHtml(stage1MondayChecklist),
      stage1NotificationSelfTestHtml: stage1NotificationSelfTestMod.renderCustomerStage1NotificationSelfTestPanelHtml(stage1NotificationSelfTest),
      stage1OperatorConsoleHtml: stage1OperatorConsoleMod.renderCustomerStage1OperatorConsoleHtml(stage1OperatorConsole),
      stage1DetectionLatencyHtml: stage1DetectionLatencyMod.renderCustomerStage1DetectionLatencyPanelHtml(stage1DetectionLatency),
      stage1PanelHtml: stage1PanelMod.renderCustomerStage1ManualTradePanelHtml(stage1Panel),
      stage1ReconciliationHtml: stage1ReconciliationMod.renderCustomerStage1ReconciliationPanelHtml(stage1Reconciliation, req.customerAccount?.locale ?? 'en-US'),
      stage1ExitAlertHtml: stage1ExitAlertMod.renderCustomerStage1ExitAlertPanelHtml(stage1ExitAlert),
      stage1CompletionRecordHtml: stage1CompletionRecordMod.renderCustomerStage1CompletionRecordPanelHtml(stage1CompletionRecord),
      stage1PostTradeReviewHtml: stage1PostTradeReviewMod.renderCustomerStage1PostTradeReviewPanelHtml(stage1PostTradeReview, req.customerAccount?.locale ?? 'en-US'),
      stage1EvidenceDownloadHtml: stage1EvidenceDownloadMod.renderCustomerStage1EvidenceDownloadPanelHtml(stage1EvidenceDownload),
      stage1StateKey,
    });

    res.set('Cache-Control', 'no-store');
    return res.type('html').send(
      portfolioPageMod.renderCustomerPortfolioPageHtml(page),
    );
  } catch (_error) {
    res.set('Cache-Control', 'no-store');
    return res.status(500).type('html').send(
      renderThemedStatusPage({ surface: 'customer', title: 'Portfolio unavailable', message: 'Paper account balances and positions could not be loaded. Read-only. No live trading, order placement, broker contact, or broker account mutation.', href: '/customer' }),
    );
  }
});


app.post('/customer/portfolio/owned-assets', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  const mod = await import('./scanner/customer_owned_asset_store.mjs');
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
  const values = (value) => Array.isArray(value) ? value : value === undefined ? [] : [value];
  const symbols = values(req.body?.symbol);
  const quantities = values(req.body?.qty);
  const averageEntryPrices = values(req.body?.averageEntryPrice);
  const brokerLabels = values(req.body?.brokerLabel);
  const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
  if (fetchedPaperAccount?.ok !== true) {
    return res.status(503).type('text').send('Connected paper account positions could not be verified. Manual positions were not changed.');
  }
  const brokerPaperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
  const connectedSymbols = new Set((brokerPaperAccount.positions ?? []).map((position) => String(position?.symbol ?? '').toUpperCase()));
  const positions = symbols.map((symbol, index) => ({
    symbol,
    qty: quantities[index],
    averageEntryPrice: averageEntryPrices[index],
    brokerLabel: brokerLabels[index],
    source: 'manual',
  })).filter((position) => !connectedSymbols.has(String(position.symbol ?? '').trim().toUpperCase()));
  const result = mod.updateCustomerOwnedAssets(req.customerAccount?.id, positions);
  if (!result.ok) return res.status(400).type('text').send('Positions could not be saved.');
  return res.redirect(303, '/customer/portfolio?saved=1');
});

app.post('/customer/portfolio/wind-down', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  const accountStore = await import('./scanner/customer_account_store.mjs');
  const requested = String(req.body?.action ?? '') === 'exit_all';
  const result = accountStore.updateCustomerPortfolioWindDownPreference(req.customerAccount?.id, requested);
  if (!result.ok) return res.status(404).type('text').send('Customer account not found.');
  return res.redirect(303, '/customer/portfolio?windDown=1');
});


app.get('/customer/reports', requireCustomerSession, async (req, res) => {
  try {
    const reportModelMod = await import('./scanner/customer_report_model.mjs');
    const reportPageMod = await import('./scanner/customer_reports_page.mjs');
    const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');
    const fillStore = await import('./scanner/paper_trade_fill_simulation_store.mjs');
    const timeMod = await import('./scanner/customer_time.mjs');
    const realtimeAiMod = await import('./scanner/customer_report_realtime_ai_client.mjs');
    const qualityProposalMod = await import('./scanner/decision_quality_proposal_generation.mjs');
    const calibrationReviewMod = await import('./scanner/proposal_evidence_aggregation_calibration_review.mjs');
    const calibrationHistoryMod = await import('./scanner/proposal_calibration_history_store.mjs');

    const now = new Date();
    const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
    const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
    const paperLedgerHistory = Array.isArray(paperPositionLedger.records)
      ? paperPositionLedger.records
      : [];
    const fillLedgerHistory = fillStore.readPaperTradeFillSimulationRecordsIfAvailable();
    const liveScanRecords = listOpportunityFunnelAuditRecords({ maxRecords: 120 });
    const scannerEvents = liveScanRecords.flatMap((scan) => {
      const eventAt = scan?.eventAt ?? null;
      return (Array.isArray(scan?.candidates) ? scan.candidates : []).map((candidate) => Object.freeze({
        ...candidate,
        createdAt: eventAt,
        sourceTs: eventAt,
        scanId: scan?.scanId ?? null,
        scanner: scan?.scanner ?? null,
        marketOpen: scan?.marketOpen === true,
        sourceStatus: scan?.sourceStatus ?? null,
        resultState: candidate?.resultState ?? candidate?.decision ?? null,
      }));
    });

    const report = reportModelMod.buildCustomerReportModel({
      period: req.query.period ?? 'lifetime',
      year: req.query.year,
      now,
      timeZone: timeMod.customerTimezone(req.customerAccount),
      weekStartsOn: 1,
      paperAccount,
      paperLedgerHistory,
      fillLedgerHistory,
      scannerEvents,
    });
    const decisionQualityProposals = qualityProposalMod.readDecisionQualityProposalReport({
      now,
      maxRecords: 20,
      maxProposals: 100,
    });
    const proposalCalibrationReview = calibrationReviewMod.buildProposalEvidenceAggregationCalibrationReview(
      decisionQualityProposals,
      {
        now,
        maxReviewGroups: 100,
      },
    );
    const realtimeAiReview = await realtimeAiMod.requestCustomerReportRealtimeAiReview({
      input: Object.freeze({
        ...(report.aiReview?.input ?? {}),
        calibrationContext: Object.freeze({
          generatedAt: proposalCalibrationReview.generatedAt ?? null,
          analyzedProposalCount: proposalCalibrationReview.analyzedProposalCount ?? 0,
          calibrationReviewQueueCount: proposalCalibrationReview.calibrationReviewQueueCount ?? 0,
          marketOpenObservationsOnly: proposalCalibrationReview.marketOpenObservationsOnly === true,
          freshSourceObservationsOnly: proposalCalibrationReview.freshSourceObservationsOnly === true,
          groups: Object.freeze(
            (Array.isArray(proposalCalibrationReview.calibrationReviewQueue)
              ? proposalCalibrationReview.calibrationReviewQueue
              : [])
              .slice(0, 20)
              .map((group) => Object.freeze({
                groupBy: group?.groupBy ?? null,
                groupKey: group?.groupKey ?? null,
                sampleCount: group?.sampleCount ?? 0,
                calibrationBand: group?.calibrationBand ?? null,
                calibrationReviewStatus: group?.calibrationReviewStatus ?? null,
                disagreementRatePct: group?.disagreementRatePct ?? null,
                observableSourceCount: group?.observableSourceCount ?? 0,
                staleSourceCount: group?.staleSourceCount ?? 0,
              })),
          ),
          readOnly: true,
          historicalMeasurementOnly: true,
          automaticLearningAllowed: false,
          scannerLogicMutationAllowed: false,
          thresholdMutationAllowed: false,
        }),
      }),
      timeoutMs: Number(process.env.GS_REALTIME_AI_TIMEOUT_MS || 30000),
    });
    const proposalCalibrationHistoryWrite = calibrationHistoryMod.persistProposalCalibrationHistory(
      decisionQualityProposals,
      proposalCalibrationReview,
      {
        now,
        maxGroups: 100,
      },
    );
    const proposalCalibrationHistory = calibrationHistoryMod.readProposalCalibrationHistory({
      maxRecords: 30,
    });
    const reportWithRealtimeAi = Object.freeze({
      ...report,
      realtimeAiReview,
      decisionQualityProposals,
      proposalCalibrationReview,
      proposalCalibrationHistory,
      proposalCalibrationHistoryWrite,
    });

    const page = reportPageMod.buildCustomerReportsPage({
      report: reportWithRealtimeAi,
      account: req.customerAccount,
    });

    res.set('Cache-Control', 'no-store');
    return res.type('html').send(reportPageMod.renderCustomerReportsPageHtml(page));
  } catch (_error) {
    res.set('Cache-Control', 'no-store');
    return res.status(500).type('html').send(
      renderThemedStatusPage({ surface: 'customer', title: 'Reports unavailable', message: 'Paper analytics could not be loaded. Read-only. No order placement, broker contact, or account mutation.', href: '/customer' }),
    );
  }
});


app.get('/customer/scanner', requireCustomerSession, async (req, res) => {
  const mod = await import('./scanner/customer_scanner_hub.mjs');
  const scannerFilters = getCustomerZeroResultFilters(req.customerAccount?.id);
  const scannerSelections = getCustomerScannerSelections(req.customerAccount?.id);
  const premarketCache = await premarketSharedCachePromise;
  const premarketAutoStatus = premarketCache?.getDiagnostics?.() ?? null;
  const postMarketAutoStatus = postMarketRuntimeWorker.getStatus();
  const hub = mod.buildCustomerScannerHub({
    route: "/customer/scanner",
    scannerFilters: scannerFilters.ok ? scannerFilters.filters : null,
    scannerSelections: scannerSelections.ok ? scannerSelections.selections : null,
    premarketAutoStatus,
    postMarketAutoStatus,
    filtersSaved: req.query?.filtersSaved === '1',
    runStarted: req.query?.runStarted === '1',
    runBlocked: req.query?.runBlocked === '1',
  });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderCustomerScannerHubHtml(hub, req.customerAccount));
});

app.post('/customer/scanner/run', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  const toArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const modes = toArray(req.body?.modes);
  const assets = toArray(req.body?.assets);
  const priceRanges = toArray(req.body?.priceRanges);
  const states = toArray(req.body?.states);

  const allowedPriceRanges = priceRanges
    .map((value) => Number(value))
    .filter((value) => [5, 10, 50, 100, 1000].includes(value));
  const maxPrice = allowedPriceRanges.length ? Math.max(...allowedPriceRanges) : 5;
  const allowedModes = modes.filter((mode) => ['intraday', 'watchlist'].includes(mode));
  const stocksSelected = assets.includes('stocks');

  if (!stocksSelected || allowedModes.length === 0) {
    return res.redirect(303, '/customer/scanner?runBlocked=1');
  }
  const watchlistOnly = allowedModes.includes('watchlist') && !allowedModes.includes('intraday');

  const viewMod = await import('./scanner/customer_under_five_dashboard.mjs');
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
  const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');
  let source;
  if (watchlistOnly) {
    const watchlist = getCustomerWatchlist(req.customerAccount?.id);
    const watchlistSymbols = watchlist.ok ? watchlist.symbols : [];
    if (watchlistSymbols.length === 0) {
      return res.redirect(303, '/customer/watchlist');
    }
    const watchlistSourceMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    source = await watchlistSourceMod.fetchAlpacaUnderFiveUniverseReadonly({
      minPrice: 0,
      maxPrice: Number.POSITIVE_INFINITY,
      minDailyVolume: 0,
      maxAssets: 50,
      symbols: watchlistSymbols,
    });
  } else {
    source = await getUnderFiveSharedSource({ refresh: true });
  }
  const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
  const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
  const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
  const paperLedger = paperPositionLedger.latestRecord ?? {};
  const resultFilters = states.length ? { states } : getCustomerZeroResultFilters(req.customerAccount?.id).filters;
  const dashboard = viewMod.buildCustomerUnderFiveDashboard(source, {
    route: '/customer/scanner/run',
    resultFilters,
    maxPrice,
    noPriceCeiling: watchlistOnly,
    paperAccount,
    paperLedger,
    paperLedgerHistory: paperPositionLedger.records,
    performanceSourceTs: paperLedger.lastUpdatedAt ?? paperLedger.createdAt ?? null,
    equity: paperAccount.accountHealthy ? paperAccount.account.equity : null,
    buyingPower: paperAccount.accountHealthy ? paperAccount.account.buyingPower : null,
    role: 'customer',
    roleLabel: 'Customer',
    tenant: 'customer',
    portfolioWindDownActive: req.customerAccount?.portfolioWindDownRequested === true,
    title: watchlistOnly
      ? 'Watchlist Scanner'
      : `$0–$${maxPrice.toLocaleString('en-US')} Intraday Scanner`,
  });
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(viewMod.renderCustomerUnderFiveDashboardHtml(dashboard, req.customerAccount));
});

app.get('/customer/watchlist', requireCustomerSession, async (req, res) => {
  const mod = await import('./scanner/customer_watchlist_page.mjs');
  const watchlist = getCustomerWatchlist(req.customerAccount?.id);
  const page = mod.buildCustomerWatchlistPage({
    symbols: watchlist.ok ? watchlist.symbols : [],
    updatedAt: watchlist.ok ? watchlist.updatedAt : null,
    saved: req.query?.saved === '1',
  });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderCustomerWatchlistPageHtml(page, req.customerAccount));
});

app.post('/customer/watchlist', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  const symbols = String(req.body?.symbols ?? '').split(',');
  const result = updateCustomerWatchlist(req.customerAccount?.id, symbols);
  if (!result.ok) {
    return res.status(404).type('text').send('Customer account not found.');
  }
  return res.redirect(303, '/customer/watchlist?saved=1');
});

app.get('/customer/security-activity', requireCustomerSession, async (req, res) => {
  const mod = await import('./scanner/customer_security_activity_page.mjs');
  const activity = listCustomerSecurityActivity(req.customerAccount?.id, { limit: 50 });
  const page = mod.buildCustomerSecurityActivityPage({ activity, account: req.customerAccount });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderCustomerSecurityActivityPageHtml(page));
});


app.get('/assets/customer-scanner-controls.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('application/javascript').send(`(() => {
  const groups = [...document.querySelectorAll('[data-multiselect]')];
  const priceRangeGroup = document.querySelector('[data-multiselect="priceRanges"]');
  const includeNestedPriceRanges = (changedBox) => {
    if (!priceRangeGroup || !changedBox?.checked) return;
    const ceiling = Number(changedBox.value);
    priceRangeGroup.querySelectorAll('input[name="priceRanges"]:not(:disabled)').forEach((box) => {
      if (Number(box.value) <= ceiling) box.checked = true;
    });
  };
  const update = (group) => {
    const boxes = [...group.querySelectorAll('input[type="checkbox"][name]:not(:disabled)')];
    const checked = boxes.filter((box) => box.checked);
    const count = group.querySelector('[data-selection-count]');
    const selectAll = group.querySelector('[data-select-all]');
    if (count) count.textContent = checked.length + ' selected';
    if (selectAll) {
      selectAll.checked = boxes.length > 0 && checked.length === boxes.length;
      selectAll.indeterminate = checked.length > 0 && checked.length < boxes.length;
    }
  };
  groups.forEach((group) => {
    const selectAll = group.querySelector('[data-select-all]');
    selectAll?.addEventListener('change', () => {
      group.querySelectorAll('input[type="checkbox"][name]:not(:disabled)').forEach((box) => {
        box.checked = selectAll.checked;
      });
      update(group);
    });
    group.querySelectorAll('input[type="checkbox"][name]').forEach((box) => {
      box.addEventListener('change', () => {
        if (box.name === 'priceRanges') includeNestedPriceRanges(box);
        update(group);
      });
    });
    update(group);
  });
})();`);
});

app.get(['/assets/password-visibility.js', '/customer/assets/password-visibility.js'], (_req, res) => {
  res.type('application/javascript').send(`(() => {
    const enhance = (input, index) => {
      if (!(input instanceof HTMLInputElement) || input.type !== 'password') return;
      if (input.dataset.passwordVisibilityEnhanced === 'true') return;
      input.dataset.passwordVisibilityEnhanced = 'true';
      if (!input.id) input.id = \`password-field-\${index + 1}\`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'password-visibility-toggle';
      button.setAttribute('aria-controls', input.id);
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Show password';
      button.addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        button.setAttribute('aria-pressed', String(!showing));
        button.textContent = showing ? 'Show password' : 'Hide password';
      });
      input.insertAdjacentElement('afterend', button);
    };
    document.querySelectorAll('input[type="password"]').forEach(enhance);
  })();`);
});

app.get('/assets/customer-settings.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript').send(`(() => {
  const body = document.body;
  const applyTheme = (theme, density, reduced) => {
    window.GeminiScannerTheme?.apply?.(theme, density, reduced);
    try {
      localStorage.setItem('gs.theme', theme || 'system');
      localStorage.setItem('gs.density', density || 'comfortable');
      localStorage.setItem('gs.reducedMotion', reduced ? 'true' : 'false');
    } catch (_) {}
  };
  if (body?.dataset?.gsPage === 'customer-settings') {
    applyTheme(body.dataset.gsTheme || 'system', body.dataset.gsDensity || 'comfortable', body.dataset.gsReducedMotion === 'true');
    const appearanceForm = document.querySelector('form[action="/customer/settings/display"]');
    const themeControl = appearanceForm?.querySelector('[name="theme"]');
    const densityControl = appearanceForm?.querySelector('[name="density"]');
    const reducedControl = appearanceForm?.querySelector('[name="reducedMotion"]');
    const preview = () => applyTheme(themeControl?.value || 'system', densityControl?.value || 'comfortable', reducedControl?.checked === true);
    themeControl?.addEventListener('change', preview);
    densityControl?.addEventListener('change', preview);
    reducedControl?.addEventListener('change', preview);
  }
  const root = document.querySelector('main[data-page="settings"] .card');
  const toolbar = root?.querySelector('.settings-toolbar');
  if (!root || !toolbar) return;
  const sections = [...root.querySelectorAll(':scope > section')];
  sections.forEach((section) => {
    const heading = section.querySelector(':scope > h2');
    if (!heading) return;
    const title = heading.textContent.trim();
    const details = document.createElement('details');
    details.className = 'settings-group';
    if (['Deactivate account', 'Permanently delete account'].includes(title)) details.classList.add('danger-settings');
    details.open = ['Security'].includes(title);
    const summary = document.createElement('summary');
    summary.textContent = title;
    section.before(details);
    details.append(summary, section);
    const shortcut = document.createElement('button');
    shortcut.type = 'button';
    shortcut.textContent = title;
    shortcut.addEventListener('click', () => {
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toolbar.append(shortcut);
  });
})();`);
});

app.get('/customer/settings', requireCustomerSession, async (req, res) => {
  const account = req.customerAccount;
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const memberSince = formatCustomerDate(account?.createdAt, account, { fallback: 'Unavailable' });
  const lastSignIn = formatCustomerDateTime(account?.lastLoginAt, account);
  const recentLoginHistory = Array.isArray(account?.recentLoginHistory) ? account.recentLoginHistory : [];
  const latestLogin = recentLoginHistory[0] ?? null;
  const earlierLogins = recentLoginHistory.slice(1);

  const email = esc(account?.email);
  const status = esc(account?.status || 'unknown');
  const verificationStatus = account?.emailVerified ? 'Verified' : 'Not verified';
  const customerId = esc(account?.id || 'Unavailable');
  res.set('Cache-Control', 'no-store');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — Customer settings</title>
${renderGlobalThemeCss({ surface: 'customer' })}
${renderCustomerPrimaryNavigationCss()}
<style>
.wrap{max-width:860px;margin:0 auto;padding:42px 20px 72px}
.card{padding:20px}
.details{margin:20px 0}
.row{display:grid;grid-template-columns:minmax(150px,220px) 1fr;gap:16px;padding:12px 0;border-bottom:1px solid var(--gs-line)}
.row:last-child{border-bottom:0}
.label{color:var(--gs-muted);font-weight:700}
.value{overflow-wrap:anywhere}
input,select{width:100%;max-width:520px;border:1px solid var(--gs-line);border-radius:10px;background:rgba(0,0,0,.72);color:var(--gs-text);padding:10px;font:inherit}
input[type="checkbox"]{width:auto}
button{padding:12px 18px;border:1px solid var(--gs-line);border-radius:10px;background:rgba(0,0,0,.72);color:var(--gs-text);font-weight:700;cursor:pointer}
section[style]{border-top-color:var(--gs-line)!important}
.settings-secondary-nav{display:flex;flex-wrap:wrap;gap:10px;margin:-4px 0 18px}
.settings-secondary-nav a{color:var(--gs-muted);text-decoration:none;border:1px solid var(--gs-line);border-radius:10px;padding:8px 11px;background:rgba(0,0,0,.48)}
.settings-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 22px;padding:12px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.5)}
.settings-toolbar button{padding:8px 11px;background:rgba(24,215,255,.08)}
.settings-group{margin-top:14px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(2,9,12,.72);overflow:hidden}
.settings-group>summary{cursor:pointer;list-style:none;padding:16px 18px;font-size:1.05rem;font-weight:900;color:var(--gs-text);display:flex;align-items:center;justify-content:space-between}
.settings-group>summary::-webkit-details-marker{display:none}
.settings-group>summary::after{content:"+";color:var(--gs-accent);font-size:1.35rem}
.settings-group[open]>summary{border-bottom:1px solid var(--gs-line);background:rgba(24,215,255,.06)}
.settings-group[open]>summary::after{content:"−"}
.settings-group>section{margin:0!important;padding:18px!important;border:0!important;border-radius:0;background:transparent;backdrop-filter:none}
.settings-group>section>h2{display:none}
.danger-settings>summary{color:#ffd5da}.danger-settings{border-color:rgba(255,53,71,.48)}
.signin-history{margin-top:10px;border:1px solid var(--gs-line);border-radius:12px;padding:0 14px;background:rgba(0,0,0,.32)}
.signin-history>summary{cursor:pointer;padding:12px 2px;font-weight:800;color:var(--gs-accent)}
@media (max-width:600px){.row{grid-template-columns:1fr;gap:4px}.settings-toolbar{position:sticky;top:8px;z-index:8}.settings-group>summary{padding:14px}}
</style>
</head>
<body data-gs-page="customer-settings" data-gs-theme="${esc(account?.displayPreferences?.theme || 'system')}" data-gs-density="${esc(account?.displayPreferences?.density || 'comfortable')}" data-gs-reduced-motion="${account?.displayPreferences?.reducedMotion ? 'true' : 'false'}">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'customer', homeHref: '/customer', label: 'GeminiScanner' })}
<main class="wrap" data-role="customer" data-page="settings">
${renderCustomerPrimaryNavigation({ active: 'settings' })}
<nav class="settings-secondary-nav" aria-label="Settings navigation">
<a href="/customer/security-activity">Security activity</a>
</nav>
<section class="card">
<h1>Settings</h1>
<p style="color:var(--gs-muted)">Account, scanner, security, and privacy controls are grouped below. Open only the section you need.</p>
<div class="settings-toolbar" aria-label="Settings section shortcuts"></div>
<h2>Account details</h2>
<form method="post" action="/customer/settings/profile">
<p><label for="firstName">First name</label><br>
<input id="firstName" name="firstName" type="text" value="${esc(account?.firstName || '')}" autocomplete="given-name" required></p>
<p><label for="lastName">Last name</label><br>
<input id="lastName" name="lastName" type="text" value="${esc(account?.lastName || '')}" autocomplete="family-name" required></p>
<p><button type="submit" style="background:#3d72d9">Save profile</button></p>
</form>
<div class="details">
<div class="row"><div class="label">Email</div><div class="value">${email}</div></div>
${account?.pendingEmail ? `<div class="row"><div class="label">Pending email</div><div class="value">${esc(account.pendingEmail)} (verification required)</div></div>` : ''}
<h3>Change email</h3>
<form method="post" action="/customer/settings/email">
<p><label for="newEmail">New email address</label><br>
<input id="newEmail" name="newEmail" type="email" autocomplete="email" required></p>
<p><label for="emailChangePassword">Current password</label><br>
<input id="emailChangePassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><button type="submit" style="background:#3d72d9">Send verification email</button></p>
</form>
<div class="row"><div class="label">Account status</div><div class="value">${status}</div></div>
<div class="row"><div class="label">Email verification</div><div class="value">${verificationStatus}</div></div>
<div class="row"><div class="label">Customer ID</div><div class="value">${customerId}</div></div>
<div class="row"><div class="label">Member since</div><div class="value">${esc(memberSince)}</div></div>
<div class="row"><div class="label">Last sign-in</div><div class="value">${esc(lastSignIn)}</div></div>
<div class="row"><div class="label">Last sign-in IP</div><div class="value">${esc(account?.lastLoginIp || 'Not available')}</div></div>
<div class="row"><div class="label">Last sign-in device</div><div class="value">${esc(account?.lastLoginUserAgent || 'Not available')}</div></div>
<div class="row"><div class="label">Successful sign-ins</div><div class="value">${esc(account?.loginCount ?? 0)}</div></div>
</div>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Security activity</h2>
<h3>Recent sign-ins</h3>
${latestLogin
  ? `<div class="details"><div class="row"><div class="label">${esc(formatCustomerDateTime(latestLogin.loginAt, account, { fallback: 'Unknown time' }))}</div><div class="value">${esc(latestLogin.ip || 'unknown')} | ${esc(latestLogin.userAgent || 'unknown')}</div></div></div>${earlierLogins.length ? `<details class="signin-history"><summary>Show ${earlierLogins.length} earlier sign-in${earlierLogins.length === 1 ? '' : 's'}</summary><div class="details">${earlierLogins.map((entry) => `<div class="row"><div class="label">${esc(formatCustomerDateTime(entry?.loginAt, account, { fallback: 'Unknown time' }))}</div><div class="value">${esc(entry?.ip || 'unknown')} | ${esc(entry?.userAgent || 'unknown')}</div></div>`).join('')}</div></details>` : ''}`
  : '<p style="color:#9eb0c9">No recent sign-in activity is available yet.</p>'}
<p style="color:#9eb0c9">Review password, email, authenticator, session, and account security changes on the complete read-only activity page.</p>
<p><a href="/customer/security-activity">View complete security activity</a></p>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Security</h2>
<h3>Authenticator app</h3>
${account?.authenticatorEnabled ? `
<p><strong>Status:</strong> Enabled</p>
<p style="color:#9eb0c9">Authenticator verification is active for this account.</p>
<p><strong>Recovery codes remaining:</strong> ${esc(Array.isArray(account?.authenticatorRecoveryCodeHashes) ? account.authenticatorRecoveryCodeHashes.length : 0)}</p>
<form method="post" action="/customer/settings/authenticator/recovery-codes/regenerate">
<p><label for="regenerateRecoveryPassword">Current password</label><br>
<input id="regenerateRecoveryPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label for="regenerateRecoveryCode">Six-digit code</label><br>
<input id="regenerateRecoveryCode" name="authenticatorCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></p>
<p><button type="submit" style="background:#3d72d9">Generate new recovery codes</button></p>
</form>
<form method="post" action="/customer/settings/authenticator/disable">
<p><label for="disableAuthenticatorPassword">Current password</label><br>
<input id="disableAuthenticatorPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label for="disableAuthenticatorCode">Six-digit code</label><br>
<input id="disableAuthenticatorCode" name="authenticatorCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></p>
<p><button type="submit">Disable authenticator</button></p>
</form>
` : account?.authenticatorPendingSecret ? `
<p><strong>Status:</strong> Setup pending</p>
<p>Add this setup key to your authenticator app:</p>
<p><code style="overflow-wrap:anywhere">${esc(account.authenticatorPendingSecret)}</code></p>
<form method="post" action="/customer/settings/authenticator/confirm">
<p><label for="authenticatorCode">Six-digit code</label><br>
<input id="authenticatorCode" name="authenticatorCode" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></p>
<p><button type="submit" style="background:#3d72d9">Confirm authenticator</button></p>
</form>
` : `
<p><strong>Status:</strong> Not enabled</p>
<form method="post" action="/customer/settings/authenticator/start">
<p><button type="submit" style="background:#3d72d9">Set up authenticator</button></p>
</form>
`}
<h3>Change password</h3>
<form method="post" action="/customer/settings/password">
<p><label for="currentPassword">Current password</label><br>
<input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label for="newPassword">New password</label><br>
<input id="newPassword" name="newPassword" type="password" minlength="12" autocomplete="new-password" required></p>
<p><label for="confirmPassword">Confirm new password</label><br>
<input id="confirmPassword" name="confirmPassword" type="password" minlength="12" autocomplete="new-password" required></p>
<p><button type="submit" style="background:#3d72d9">Change password</button></p>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Notifications</h2>
<form method="post" action="/customer/settings/notifications">
<p><label><input name="scannerAlerts" type="checkbox"${account?.notificationPreferences?.scannerAlerts ? ' checked' : ''}> Scanner alerts</label></p>
<p><label><input name="accountSecurityEmails" type="checkbox" checked disabled> Account security emails</label><br>
<span style="color:#9eb0c9">Required security notices cannot be disabled.</span></p>
<p><label><input name="productUpdates" type="checkbox"${account?.notificationPreferences?.productUpdates ? ' checked' : ''}> Product updates</label></p>
<fieldset style="margin:16px 0;padding:14px;border:0;border-radius:12px;background:rgba(2,9,12,.42)">
<legend><b>Report delivery</b></legend>
<p><label><input name="reportEmailEnabled" type="checkbox"${account?.notificationPreferences?.reportEmailEnabled ? ' checked' : ''}> Email reports to my account email</label></p>
<p><label><input name="reportSmsEnabled" type="checkbox"${account?.notificationPreferences?.reportSmsEnabled ? ' checked' : ''}> Text me when reports are ready</label></p>
<p><label for="reportSmsCountryCode">Country code</label><br>
<select id="reportSmsCountryCode" name="reportSmsCountryCode" autocomplete="tel-country-code">
${[['+1','United States / Canada (+1)'],['+44','United Kingdom (+44)'],['+52','Mexico (+52)'],['+61','Australia (+61)'],['+64','New Zealand (+64)']].map(([value,label]) => `<option value="${value}"${(account?.notificationPreferences?.reportSmsCountryCode || '+1') === value ? ' selected' : ''}>${label}</option>`).join('')}
</select></p>
<p><label for="reportSmsPhone">Mobile number</label><br>
<input id="reportSmsPhone" name="reportSmsPhone" type="tel" inputmode="tel" autocomplete="tel-national" value="${esc(account?.notificationPreferences?.reportSmsPhone ?? '')}" placeholder="208 555 0123"></p>
<p style="color:#9fb6bf"><strong>Messaging and data rates may apply.</strong> Message frequency depends on the report schedules you select.</p>
<p><b>Report schedules</b></p>
${[['daily','Daily'],['weekly','Weekly'],['monthly','Monthly'],['yearly','Yearly'],['ytd','Year-to-Date'],['lifetime','Lifetime']].map(([value,label]) => `<p><label><input name="reportDelivery_${value}" type="checkbox"${account?.notificationPreferences?.reportDeliveryPeriods?.includes?.(value) ? ' checked' : ''}> ${label}</label></p>`).join('')}
<p style="color:#9fb6bf">Delivery remains off until the selected channel is configured and verified. Text delivery will send a secure report-ready notice, not trading instructions.</p>
</fieldset>
<p><button type="submit" style="background:#3d72d9">Save notifications</button></p>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Appearance</h2>
<form method="post" action="/customer/settings/display">
<p><label for="theme">Theme</label><br>
<select id="theme" name="theme">
<option value="system"${(account?.displayPreferences?.theme || 'system') === 'system' ? ' selected' : ''}>Use device setting</option>
<option value="dark"${account?.displayPreferences?.theme === 'dark' ? ' selected' : ''}>Dark</option>
<option value="light"${account?.displayPreferences?.theme === 'light' ? ' selected' : ''}>Light</option>
</select></p>
<p><label for="density">Layout density</label><br>
<select id="density" name="density">
<option value="comfortable"${(account?.displayPreferences?.density || 'comfortable') === 'comfortable' ? ' selected' : ''}>Comfortable</option>
<option value="compact"${account?.displayPreferences?.density === 'compact' ? ' selected' : ''}>Compact</option>
</select></p>
<p><label for="locale">Language and number format</label><br>
<select id="locale" name="locale">
<option value="en-US"${(account?.displayPreferences?.locale || 'en-US') === 'en-US' ? ' selected' : ''}>English (United States)</option>
<option value="en-CA"${account?.displayPreferences?.locale === 'en-CA' ? ' selected' : ''}>English (Canada)</option>
<option value="en-GB"${account?.displayPreferences?.locale === 'en-GB' ? ' selected' : ''}>English (United Kingdom)</option>
</select></p>
<p><label for="timezone">Time zone</label><br>
<select id="timezone" name="timezone">
<option value="America/New_York"${(account?.displayPreferences?.timezone || 'America/New_York') === 'America/New_York' ? ' selected' : ''}>Eastern Time</option>
<option value="America/Chicago"${account?.displayPreferences?.timezone === 'America/Chicago' ? ' selected' : ''}>Central Time</option>
<option value="America/Denver"${account?.displayPreferences?.timezone === 'America/Denver' ? ' selected' : ''}>Mountain Time</option>
<option value="America/Los_Angeles"${account?.displayPreferences?.timezone === 'America/Los_Angeles' ? ' selected' : ''}>Pacific Time</option>
<option value="America/Phoenix"${account?.displayPreferences?.timezone === 'America/Phoenix' ? ' selected' : ''}>Arizona Time</option>
<option value="America/Anchorage"${account?.displayPreferences?.timezone === 'America/Anchorage' ? ' selected' : ''}>Alaska Time</option>
<option value="Pacific/Honolulu"${account?.displayPreferences?.timezone === 'Pacific/Honolulu' ? ' selected' : ''}>Hawaii Time</option>
</select></p>
<p><label><input name="reducedMotion" type="checkbox"${account?.displayPreferences?.reducedMotion ? ' checked' : ''}> Reduce motion</label></p>
<p><button type="submit" style="background:#3d72d9">Save appearance</button></p>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Your data</h2>
<p style="color:#9eb0c9">Download a JSON copy of your customer account data. Password and authenticator secrets are excluded.</p>
<form method="post" action="/customer/settings/data/export">
<button type="submit" style="background:#3d72d9">Download my data</button>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Sessions</h2>
<p style="color:#9eb0c9">Sign out this account on every device, including this one.</p>
<form method="post" action="/customer/settings/sessions/revoke">
<button type="submit">Sign out all sessions</button>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Deactivate account</h2>
<p style="color:#9eb0c9">Deactivate this customer account and sign out every session.</p>
<form method="post" action="/customer/settings/account/deactivate">
<p><label for="deactivateAccountPassword">Current password</label><br>
<input id="deactivateAccountPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label><input name="confirmDeactivate" type="checkbox" required> I understand this will deactivate my account.</label></p>
<button type="submit">Deactivate account</button>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2>Permanently delete account</h2>
<p style="color:#9eb0c9">Permanently remove this customer account. This cannot be undone.</p>
<form method="post" action="/customer/settings/account/delete">
<p><label for="deleteAccountPassword">Current password</label><br>
<input id="deleteAccountPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label><input name="confirmPermanentDelete" type="checkbox" required> I understand this permanently deletes my account.</label></p>
<button type="submit">Permanently delete account</button>
</form>
</section>
<form method="post" action="/logout">
<button type="submit">Log out</button>
</form>
<script src="/assets/global-theme.js"></script>
<script src="/customer/assets/password-visibility.js" defer></script>
<script src="/assets/customer-settings.js" defer></script>
</section>
</main>
${renderGlobalFooter()}
</body>
</html>`);
});




app.post('/customer/settings/data/export', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = buildCustomerDataExport(req.customerAccount.id, {
    authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  });
  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'data_export_attempt', 'failure', result.reason);
    return res.status(404).type('html').send(
      '<!doctype html><html><body><main><h1>Data export unavailable</h1><p>Your customer data could not be exported.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'data_exported', 'success');
  const safeId = String(req.customerAccount.id || 'customer').replace(/[^a-zA-Z0-9_-]/g, '');
  res.set('Content-Disposition', `attachment; filename="geminiscanner-customer-data-${safeId}.json"`);
  return res.status(200).type('application/json').send(`${JSON.stringify(result.export, null, 2)}\n`);
});


app.post('/customer/settings/email', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'email_change_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const result = beginCustomerEmailChange(
    req.customerAccount.id,
    req.body?.currentPassword,
    req.body?.newEmail,
    {
      authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'email_change_attempt', 'failure', result.reason);
    const messages = {
      current_password_incorrect: 'Current password is incorrect.',
      valid_email_required: 'Enter a valid email address.',
      new_email_must_differ: 'The new email must differ from the current email.',
      email_already_in_use: 'That email address is already in use.',
    };
    const message = messages[result.reason] || 'The email change could not be started.';
    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Email change needs attention</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  const verification = createCustomerEmailVerification({
    id: result.account.id,
    email: result.account.pendingEmail,
  });
  appendCustomerEmailVerificationRecord(verification.record);

  recordCustomerSecurityAudit(req, 'email_change_requested', 'success');

  const delivery = await deliverCustomerVerificationEmail({
    email: result.account.pendingEmail,
    token: verification.token,
  });

  if (!delivery.ok) {
    return res.status(503).type('html').send(
      '<!doctype html><html><body><main><h1>Verification email delayed</h1><p>Your email change is pending, but the verification email could not be delivered. Please contact GeminiScanner support.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  return res.status(202).type('html').send(
    '<!doctype html><html><body><main><h1>Check your new email</h1><p>Open the verification link sent to your new email address. Your current email remains active until verification succeeds.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
  );
});


app.post('/customer/settings/account/delete', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'account_delete_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');
  if (req.body?.confirmPermanentDelete !== 'on') {
    recordCustomerSecurityAudit(req, 'account_delete_attempt', 'failure', 'confirmation_required');
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Account not deleted</h1><p>Permanent deletion confirmation is required.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  const result = permanentlyDeleteCustomerAccount(
    req.customerAccount.id,
    req.body?.currentPassword,
    {
      authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'account_delete_attempt', 'failure', result.reason);
    const message = result.reason === 'current_password_incorrect'
      ? 'Current password is incorrect.'
      : 'Your account could not be permanently deleted.';
    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Account not deleted</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'account_deleted', 'success');
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.redirect(303, '/');
});


app.post('/customer/settings/account/deactivate', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'account_deactivate_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');
  if (req.body?.confirmDeactivate !== 'on') {
    recordCustomerSecurityAudit(req, 'account_deactivate_attempt', 'failure', 'confirmation_required');
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Account not deactivated</h1><p>Confirmation is required.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  const result = deactivateCustomerAccount(
    req.customerAccount.id,
    req.body?.currentPassword,
    {
      authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'account_deactivate_attempt', 'failure', result.reason);
    const message = result.reason === 'current_password_incorrect'
      ? 'Current password is incorrect.'
      : 'Your account could not be deactivated.';
    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Account not deactivated</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'account_deactivated', 'success');
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.redirect(303, '/login');
});

app.post('/customer/settings/sessions/revoke', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'sessions_revoke_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');
  const result = revokeCustomerSessions(req.customerAccount.id);
  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'sessions_revoke_attempt', 'failure', result.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Sessions not revoked</h1><p>Your sessions could not be revoked.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }
  recordCustomerSecurityAudit(req, 'sessions_revoked', 'success');
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.redirect(303, '/login');
});


app.post('/customer/settings/profile', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = updateCustomerProfile(
    req.customerAccount.id,
    {
      firstName: req.body?.firstName,
      lastName: req.body?.lastName,
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'profile_update', 'failure', result.reason);
    const message = result.reason === 'first_name_required'
      ? 'First name is required.'
      : result.reason === 'last_name_required'
        ? 'Last name is required.'
        : 'Profile could not be updated.';

    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Profile not updated</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'profile_updated', 'success');
  return res.redirect(303, '/customer/settings');
});


app.post('/customer/settings/notifications', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = updateCustomerNotificationPreferences(
    req.customerAccount.id,
    {
      scannerAlerts: req.body?.scannerAlerts,
      productUpdates: req.body?.productUpdates,
      reportEmailEnabled: req.body?.reportEmailEnabled,
      reportSmsEnabled: req.body?.reportSmsEnabled,
      reportSmsCountryCode: req.body?.reportSmsCountryCode,
      reportSmsPhone: req.body?.reportSmsPhone,
      reportDeliveryPeriods: ["daily", "weekly", "monthly", "yearly", "ytd", "lifetime"]
        .filter((period) => req.body?.[`reportDelivery_${period}`] === "on"),
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'notification_preferences_update', 'failure', result.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Notifications not updated</h1><p>Notification preferences could not be saved.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'notification_preferences_updated', 'success');
  return res.redirect(303, '/customer/settings');
});




app.post('/customer/settings/authenticator/start', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'authenticator_setup_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const secret = generateCustomerAuthenticatorSecret();
  const result = beginCustomerAuthenticatorSetup(
    req.customerAccount.id,
    secret,
    { authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'authenticator_setup_attempt', 'failure', result.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Authenticator setup not started</h1><p>Authenticator setup could not be started.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'authenticator_setup_started', 'success');
  return res.redirect(303, '/customer/settings');
});



app.post('/customer/settings/authenticator/confirm', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'authenticator_confirm_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const result = confirmCustomerAuthenticatorSetup(
    req.customerAccount.id,
    req.body?.authenticatorCode,
    verifyCustomerAuthenticatorCode,
    { authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'authenticator_confirm_attempt', 'failure', result.reason);
    const message = result.reason === 'invalid_authenticator_code'
      ? 'The authenticator code is invalid or expired.'
      : result.reason === 'authenticator_setup_not_started'
        ? 'Authenticator setup has not been started.'
        : 'Authenticator setup could not be confirmed.';

    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Authenticator not enabled</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'authenticator_enabled', 'success');

  const recoveryCodes = Array.isArray(result.account?.authenticatorRecoveryCodes)
    ? result.account.authenticatorRecoveryCodes
    : [];

  return res.status(200).type('html').send(
    `<!doctype html><html><body><main><h1>Save your recovery codes</h1><p>These codes are shown only once. Store them somewhere secure.</p><ul>${recoveryCodes.map((code) => `<li><code>${esc(code)}</code></li>`).join('')}</ul><p><a href="/customer/settings">Continue to settings</a></p></main></body></html>`,
  );
});


app.post('/customer/settings/authenticator/recovery-codes/regenerate', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'authenticator_recovery_codes_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const result = regenerateCustomerAuthenticatorRecoveryCodes(
    req.customerAccount.id,
    req.body?.currentPassword,
    req.body?.authenticatorCode,
    verifyCustomerAuthenticatorCode,
    { authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'authenticator_recovery_codes_attempt', 'failure', result.reason);
    const message = result.reason === 'current_password_incorrect'
      ? 'Current password is incorrect.'
      : result.reason === 'invalid_authenticator_code'
        ? 'The authenticator code is invalid or expired.'
        : result.reason === 'authenticator_not_enabled'
          ? 'Authenticator verification is not enabled.'
          : 'Recovery codes could not be regenerated.';

    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Recovery codes not regenerated</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'authenticator_recovery_codes_regenerated', 'success');

  const recoveryCodes = Array.isArray(result.account?.authenticatorRecoveryCodes)
    ? result.account.authenticatorRecoveryCodes
    : [];

  return res.status(200).type('html').send(
    `<!doctype html><html><body><main><h1>Save your new recovery codes</h1><p>Your previous recovery codes are now invalid. These new codes are shown only once.</p><ul>${recoveryCodes.map((recoveryCode) => `<li><code>${esc(recoveryCode)}</code></li>`).join('')}</ul><p><a href="/customer/settings">Continue to settings</a></p></main></body></html>`,
  );
});


app.post('/customer/settings/authenticator/disable', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'authenticator_disable_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const result = disableCustomerAuthenticator(
    req.customerAccount.id,
    req.body?.currentPassword,
    req.body?.authenticatorCode,
    verifyCustomerAuthenticatorCode,
    { authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'authenticator_disable_attempt', 'failure', result.reason);
    const message = result.reason === 'current_password_incorrect'
      ? 'Current password is incorrect.'
      : result.reason === 'invalid_authenticator_code'
        ? 'The authenticator code is invalid or expired.'
        : result.reason === 'authenticator_not_enabled'
          ? 'Authenticator verification is not enabled.'
          : 'Authenticator verification could not be disabled.';

    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Authenticator not disabled</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'authenticator_disabled', 'success');
  return res.redirect(303, '/customer/settings');
});


app.post('/customer/settings/display', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = updateCustomerDisplayPreferences(
    req.customerAccount.id,
    {
      theme: req.body?.theme,
      density: req.body?.density,
      locale: req.body?.locale,
      timezone: req.body?.timezone,
      reducedMotion: req.body?.reducedMotion,
    },
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'display_preferences_update', 'failure', result.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Appearance not updated</h1><p>Display preferences could not be saved.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'display_preferences_updated', 'success');
  const refreshedToken = createCustomerSessionToken(result.account, { secret: CUSTOMER_SESSION_SECRET });
  res.cookie(CUSTOMER_COOKIE_NAME, refreshedToken, buildCustomerSessionCookieOptions());
  return res.redirect(303, '/customer/settings');
});


app.post('/customer/scanner/reset', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const result = updateCustomerZeroResultFilters(
    req.customerAccount.id,
    { states: [] },
  );
  const selectionsResult = updateCustomerScannerSelections(
    req.customerAccount.id,
    { modes: [], assets: [], priceRanges: [] },
  );

  if (!result.ok || !selectionsResult.ok) {
    recordCustomerSecurityAudit(req, 'customer_scanner_settings_reset', 'failure', result.reason ?? selectionsResult.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Scanner settings not reset</h1><p>Customer scanner settings could not be reset.</p><p><a href="/customer/scanner">Return to scanner</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'customer_scanner_settings_reset', 'success');
  return res.redirect(303, '/customer/scanner?filtersSaved=1');
});

app.post('/customer/scanner/filters', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');

  const toArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
  const states = toArray(req.body?.states);
  const modes = toArray(req.body?.modes);
  const assets = toArray(req.body?.assets);
  const priceRanges = toArray(req.body?.priceRanges);

  const result = updateCustomerZeroResultFilters(
    req.customerAccount.id,
    { states },
  );
  const selectionsResult = updateCustomerScannerSelections(
    req.customerAccount.id,
    { modes, assets, priceRanges },
  );

  if (!result.ok || !selectionsResult.ok) {
    recordCustomerSecurityAudit(req, 'customer_zero_result_filters_update', 'failure', result.reason ?? selectionsResult.reason);
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Scanner filters not updated</h1><p>Customer scanner filters could not be saved.</p><p><a href="/customer/scanner">Return to scanner</a></p></main></body></html>',
    );
  }

  recordCustomerSecurityAudit(req, 'customer_zero_result_filters_updated', 'success');
  return res.redirect(303, '/customer/scanner?filtersSaved=1');
});


app.post('/customer/settings/password', requireCustomerSession, requireCustomerSameOrigin, (req, res) => {
  if (customerSensitiveSettingsRateLimiter.isLimited(req)) {
    recordCustomerSecurityAudit(req, 'password_change_attempt', 'blocked', 'rate_limited');
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(
      '<!doctype html><html><body><main><h1>Too many security changes</h1><p>Please wait before trying again.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  res.set('Cache-Control', 'no-store');

  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');

  if (newPassword !== confirmPassword) {
    recordCustomerSecurityAudit(req, 'password_change_attempt', 'failure', 'password_confirmation_mismatch');
    return res.status(400).type('html').send(
      '<!doctype html><html><body><main><h1>Password not changed</h1><p>New password and confirmation do not match.</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>',
    );
  }

  const result = updateCustomerPassword(
    req.customerAccount.id,
    currentPassword,
    newPassword,
  );

  if (!result.ok) {
    recordCustomerSecurityAudit(req, 'password_change_attempt', 'failure', result.reason);
    const message = result.reason === 'current_password_incorrect'
      ? 'Current password is incorrect.'
      : result.reason === 'new_password_too_short'
        ? 'New password must contain at least 12 characters.'
        : result.reason === 'new_password_must_differ'
          ? 'New password must be different from the current password.'
          : 'Password could not be changed.';

    return res.status(400).type('html').send(
      `<!doctype html><html><body><main><h1>Password not changed</h1><p>${message}</p><p><a href="/customer/settings">Return to settings</a></p></main></body></html>`,
    );
  }

  recordCustomerSecurityAudit(req, 'password_changed', 'success');
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());

  return res.status(200).type('html').send(
    '<!doctype html><html><body><main><h1>Password changed</h1><p>Your password was updated. Sign in again with the new password.</p><p><a href="/login">Continue to sign in</a></p></main></body></html>',
  );
});


app.get('/customer/scanner/exit-demo', requireCustomerSession, async (req, res) => {
  try {
    const viewMod = await import('./scanner/customer_under_five_dashboard.mjs');
    const dashboard = viewMod.buildCustomerUnderFiveDashboard({
      sourceStatus: 'connected_readonly',
      marketClock: { isOpen: true },
      candidates: [{
        symbol: 'DEMO',
        companyName: 'Flashing EXIT demonstration',
        price: 12.34,
        decision: 'EXIT',
        exitRequired: true,
        sourceAgeSec: 1,
        sourceStale: false,
        reason: ['Demonstration only — no broker contact or order placement.'],
      }],
    }, {
      route: '/customer/scanner/exit-demo',
      maxPrice: 50,
      paperAccount: {
        connected: true,
        accountHealthy: true,
        positions: [{ symbol: 'DEMO', qty: 1 }],
      },
      marketOpen: true,
      paperExecutionEnabled: true,
      operatorApproved: true,
      killSwitchActive: false,
      duplicateOrderDetected: false,
      priceDeviationOk: true,
      spreadLiquidityOk: true,
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer',
      title: 'Flashing EXIT Demo',
      refreshIntervalSec: 0,
      now: new Date(),
    });
    res.set('Cache-Control', 'no-store');
    res.type('html').send(viewMod.renderCustomerUnderFiveDashboardHtml(dashboard, req.customerAccount));
  } catch (_err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>EXIT demo unavailable</h1><p>Read-only. No execution controls.</p></body></html>');
  }
});

app.get('/customer/scanner/under-five/:symbol', requireCustomerSession, async (req, res) => {
  try {
    const detailMod = await import('./scanner/customer_zero_under_five_symbol_detail.mjs');
    const source = await getUnderFiveSharedSource();
    const symbol = String(req.params.symbol ?? '').trim().toUpperCase();
    const candidate = source.candidates?.find((item) => item.symbol === symbol);
    if (!candidate) {
      return res.status(404).type('html').send('<!doctype html><html><body><h1>Symbol not found</h1><p>Return to the scanner.</p></body></html>');
    }
    const detail = detailMod.buildCustomerZeroUnderFiveSymbolDetail(candidate, {
      routeBase: '/customer/scanner/under-five',
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer',
    });
    res.set('Cache-Control', 'no-store');
    res.type('html').send(detailMod.renderCustomerZeroUnderFiveSymbolDetailHtml(detail, req.customerAccount));
  } catch (_err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Scan detail unavailable</h1><p>Read-only. No execution controls.</p></body></html>');
  }
});

app.get('/customer/scanner/under-five', requireCustomerSession, async (req, res) => {
  try {
    const viewMod = await import('./scanner/customer_under_five_dashboard.mjs');
    const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');
    const ownedMonitorSourceMod = await import('./scanner/customer_owned_position_monitor_source.mjs');
    const source = await getUnderFiveSharedSource();
    const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
    const ownedMarketSourceMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const ownedMonitorSource = await ownedMonitorSourceMod.fetchCustomerOwnedPositionMonitorSource({
      paperAccount,
      fetchSymbols: (options = {}) => ownedMarketSourceMod.fetchAlpacaUnderFiveUniverseReadonly({
        ...options,
        env: process.env,
      }),
    });
    const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
    const paperLedger = paperPositionLedger.latestRecord ?? {};
    const resultFilters = getCustomerZeroResultFilters(req.customerAccount?.id).filters;
    const requestedMaxPrice = Number(req.query.maxPrice);
    const maxPrice = [5, 10, 50, 100, 1000].includes(requestedMaxPrice) ? requestedMaxPrice : 5;
    const dashboard = viewMod.buildCustomerUnderFiveDashboard(source, {
      route: '/customer/scanner/under-five',
      resultFilters,
      paperAccount,
      ownedPositionCandidates: ownedMonitorSource.candidates,
      paperLedger,
      paperLedgerHistory: paperPositionLedger.records,
      performancePeriod: req.query.period,
      performanceSourceTs: paperLedger.lastUpdatedAt ?? paperLedger.createdAt ?? null,
      equity: paperAccount.accountHealthy ? paperAccount.account.equity : null,
      buyingPower: paperAccount.accountHealthy ? paperAccount.account.buyingPower : null,
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer',
      portfolioWindDownActive: req.customerAccount?.portfolioWindDownRequested === true,
      title: `$0–$${maxPrice.toLocaleString('en-US')} Scanner`,
      maxPrice,
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now: new Date(),
    });
    res.set('Cache-Control', 'no-store');
    res.type('html').send(viewMod.renderCustomerUnderFiveDashboardHtml(dashboard, req.customerAccount));
  } catch (_err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Under $5 Scanner</h1><p>Unavailable.</p><p>Read-only. No execution controls.</p></body></html>');
  }
});



async function renderCustomerZeroPortfolioHub(req, res) {
  const mod = await import('./scanner/customer_scanner_hub.mjs');
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
  const portfolioMod = await import('./scanner/customer_zero_portfolio_summary.mjs');
  const performanceMod = await import('./scanner/customer_zero_performance_report.mjs');
  const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');

  const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
  const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
  const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
  const paperLedger = paperPositionLedger.latestRecord ?? {};
  const portfolioSummary = portfolioMod.buildCustomerZeroPortfolioSummary({ paperAccount });
  const performanceReport = performanceMod.buildCustomerZeroPerformanceReport({
    period: req.query.period ?? 'lifetime',
    defaultPeriod: 'lifetime',
    sourceTs: paperLedger.lastUpdatedAt ?? paperLedger.createdAt ?? null,
    paperAccount,
    paperLedger,
    paperLedgerHistory: paperPositionLedger.records,
    now: new Date(),
  });
  const hub = mod.buildCustomerScannerHub({
    tenant: 'customer-zero',
    portfolioSummary,
    performanceReport,
  });
  res.set('Cache-Control', 'no-store');
  return res.type('html').send(mod.renderCustomerScannerHubHtml(hub));
}

app.get('/customer-zero', async (req, res) => {
  return renderCustomerZeroPortfolioHub(req, res);
});

app.get('/customer-zero/scanner', async (req, res) => {
  return renderCustomerZeroPortfolioHub(req, res);
});


app.get('/customer-zero/under-five-scanner/:symbol', async (req, res) => {
  try {
    const detailMod = await import('./scanner/customer_zero_under_five_symbol_detail.mjs');
    const source = await getUnderFiveSharedSource();
    const symbol = String(req.params.symbol ?? '').trim().toUpperCase();
    const candidate = source.candidates?.find((item) => item.symbol === symbol);
    if (!candidate) {
      return res.status(404).type('html').send('<!doctype html><html><body><h1>Symbol not found</h1><p>Return to the scanner.</p></body></html>');
    }
    const detail = detailMod.buildCustomerZeroUnderFiveSymbolDetail(candidate, {
      routeBase: '/customer-zero/under-five-scanner',
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer-zero',
    });
    res.set('Cache-Control', 'no-store');
    res.type('html').send(detailMod.renderCustomerZeroUnderFiveSymbolDetailHtml(detail));
  } catch (err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Scan detail unavailable</h1><p>Read-only. No execution controls.</p></body></html>');
  }
});


app.get('/customer-zero/under-five-scanner', async (req, res) => {
  try {
    const viewMod = await import('./scanner/customer_under_five_dashboard.mjs');
    const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const positionStore = await import('./scanner/paper_trade_position_state_store.mjs');
    const ownedMonitorSourceMod = await import('./scanner/customer_owned_position_monitor_source.mjs');
    const source = await getUnderFiveSharedSource();
    const fetchedPaperAccount = await accountData.fetchAlpacaPaperAccountReadonly();
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
    const ownedMarketSourceMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const ownedMonitorSource = await ownedMonitorSourceMod.fetchCustomerOwnedPositionMonitorSource({
      paperAccount,
      fetchSymbols: (options = {}) => ownedMarketSourceMod.fetchAlpacaUnderFiveUniverseReadonly({
        ...options,
        env: process.env,
      }),
    });
    const paperPositionLedger = positionStore.readPaperTradePositionStateStoreDashboard();
    const paperLedger = paperPositionLedger.latestRecord ?? {};
    const requestedMaxPrice = Number(req.query.maxPrice);
    const maxPrice = [5, 10, 50, 100, 1000].includes(requestedMaxPrice) ? requestedMaxPrice : 5;
    const dashboard = viewMod.buildCustomerZeroUnderFiveDashboard(source, {
      route: '/customer-zero/under-five-scanner',
      paperAccount,
      ownedPositionCandidates: ownedMonitorSource.candidates,
      paperLedger,
      paperLedgerHistory: paperPositionLedger.records,
      performancePeriod: req.query.period,
      performanceSourceTs: paperLedger.lastUpdatedAt ?? paperLedger.createdAt ?? null,
      equity: paperAccount.accountHealthy ? paperAccount.account.equity : null,
      buyingPower: paperAccount.accountHealthy ? paperAccount.account.buyingPower : null,
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer-zero',
      title: `$0–$${maxPrice.toLocaleString('en-US')} Scanner`,
      maxPrice,
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now: new Date(),
    });
    res.set('Cache-Control', 'no-store');
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
