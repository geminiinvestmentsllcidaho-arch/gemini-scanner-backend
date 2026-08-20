import { randomBytes } from 'node:crypto';
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
import { getPaperTradeIntentPlan } from "./scanner/paper_trade_intent_planner.mjs";
import { buildPaperTradeIntentPlanAppScreen, renderPaperTradeIntentPlanAppScreenHtml } from "./scanner/paper_trade_intent_plan_app_screen.mjs";
import { getPaperTradingReadinessGate } from "./scanner/paper_trading_readiness_gate.mjs";
import { buildPaperReadinessGateAppScreen, renderPaperReadinessGateAppScreenHtml } from "./scanner/paper_readiness_gate_app_screen.mjs";
import { buildAlpacaPaperAccountStatusAppScreen, renderAlpacaPaperAccountStatusAppScreenHtml } from "./scanner/alpaca_paper_account_status_app_screen.mjs";
import fs from "node:fs";
import path from "node:path";
import dotenv from 'dotenv';
import express from 'express';
import { injectGeminiScannerBrandHeader } from './scanner/brand_header.mjs';
import { renderCustomerIcon } from './scanner/customer_icons.mjs';
import { buildCustomerSignupPage, renderCustomerSignupPageHtml } from './scanner/customer_signup_page.mjs';
import { createCustomerAccountRecord, appendCustomerAccountRecord, findCustomerAccountByEmail, findCustomerAccountById, markCustomerEmailVerified, beginCustomerEmailChange, completeCustomerEmailChange, buildCustomerDataExport, updateCustomerPassword, resetCustomerPassword, updateCustomerProfile, updateCustomerNotificationPreferences, updateCustomerDisplayPreferences, getCustomerZeroResultFilters, updateCustomerZeroResultFilters, getCustomerScannerSelections, updateCustomerScannerSelections, beginCustomerAuthenticatorSetup, confirmCustomerAuthenticatorSetup, disableCustomerAuthenticator, regenerateCustomerAuthenticatorRecoveryCodes, consumeCustomerAuthenticatorRecoveryCode, revokeCustomerSessions, recordCustomerLogin, deactivateCustomerAccount, permanentlyDeleteCustomerAccount, getCustomerWatchlist, updateCustomerWatchlist, getCustomerPerformanceEpoch } from './scanner/customer_account_store.mjs';
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
import { createAdminLoginRateLimiter } from './scanner/admin_login_rate_limit.mjs';
import { evaluateAdminPassword, isStrongAdminPassword } from './scanner/admin_password_auth.mjs';
import { createCustomerSignupRateLimiter } from './scanner/customer_signup_rate_limit.mjs';
import { createCustomerPasswordResetRateLimiter } from './scanner/customer_password_reset_rate_limit.mjs';
import { createCustomerSensitiveSettingsRateLimiter } from './scanner/customer_sensitive_settings_rate_limit.mjs';
import { appendCustomerSecurityAuditRecord } from './scanner/customer_security_audit_store.mjs';
import { listCustomerSecurityActivity } from './scanner/customer_security_activity_reader.mjs';
import { formatCustomerDate, formatCustomerDateTime } from './scanner/customer_time.mjs';
import { startMarketDataStream } from './market_data_stream.js';
import { createPaperAutoExitMonitorWorker } from './scanner/paper_auto_exit_monitor_worker.mjs';
import { createPaperAutoExecutionContinuityRuntime } from './scanner/paper_auto_execution_continuity_runtime.mjs';
import { DEFAULT_POINTER_FILE as PAPER_AUTO_EXECUTION_ACTIVE_LIFECYCLE_POINTER_FILE, resolvePaperAutoExecutionActiveLifecycleFile, writePaperAutoExecutionActiveLifecyclePointer } from './scanner/paper_auto_execution_active_lifecycle_pointer.mjs';
import { createPaperAutoExecutionContinuityEnterRunner } from './scanner/paper_auto_execution_continuity_enter_runner.mjs';
import { evaluatePaperAutoExecutionExecutionAssurance } from './scanner/paper_auto_execution_execution_assurance.mjs';
import { createPaperAutoExecutionExitRecoveryRunner } from './scanner/paper_auto_execution_exit_recovery_runner.mjs';
import { createPaperAutoExecutionExitReplacementRunner } from './scanner/paper_auto_execution_exit_replacement_runner.mjs';
import { fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly } from './scanner/paper_auto_execution_exit_replacement_order_lookup.mjs';
import { getPersistedPremarketCapitalBaseline } from './scanner/premarket_capital_baseline_runtime.mjs';
import { createPaperAutoExecutionScaleRunner, derivePaperScaleActionFile } from './scanner/paper_auto_execution_scale_runner.mjs';
import { createPaperAutoExecutionDegradedBrokerMode } from './scanner/paper_auto_execution_degraded_broker_mode.mjs';
import { PaperAutoExecutionScaleActionStore } from './scanner/paper_auto_execution_scale_action_store.mjs';
import { fetchAlpacaPaperAccountReadonly } from './scanner/alpaca_paper_account_readonly_fetch.mjs';
import { fetchCustomerOwnedPositionMonitorSource } from './scanner/customer_owned_position_monitor_source.mjs';
import { fetchAlpacaUnderFiveUniverseReadonly } from './scanner/alpaca_under_five_universe_readonly.mjs';
import { fetchAlpacaPaperOrderByClientOrderIdReadonly } from './scanner/paper_auto_execution_scale_order_lookup.mjs';
import { createPaperAutoExecutionAlpacaPaperAdapter } from './scanner/paper_auto_execution_alpaca_paper_adapter.mjs';
import { mapLiveUnderFiveUniverseToRankingEnvelope, normalizeCandidates } from './scanner/paper_auto_execution_mechanical_enter_only_cli.mjs';
import { resolveInternalOwnerAlpacaReadonlyCredentials } from './scanner/internal_owner_alpaca_readonly_credentials.mjs';
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
import { authorizePaperAutoExecutionCandidate } from './scanner/paper_auto_execution_strategy_authorization.mjs';
import { buildCustomerScannerFreshnessDiagnostic } from './scanner/customer_scanner_freshness_diagnostic.mjs';
import { appendOpportunityFunnelAuditRecord, listOpportunityFunnelAuditRecords, listOpportunityFunnelAuditRecordsFiltered } from './scanner/opportunity_funnel_audit_store.mjs';
import { createCustomerReportBackgroundAiReviewWorker } from './scanner/customer_report_background_ai_review_worker.mjs';
import { runCustomerReportBackgroundAiReview } from './scanner/customer_report_background_ai_review_runner.mjs';
import { createPostMarketRuntimeWorker } from './scanner/post_market_runtime_worker.mjs';
import { fetchAlpacaMarketClockReadonly } from './scanner/alpaca_market_clock_readonly.mjs';
import { runStrategyObservationPersistence } from './scanner/strategy_observation_persistence_runner.mjs';
import { listCustomerReportBackgroundAiReviewRecords } from './scanner/customer_report_background_ai_review_store.mjs';
import { createRequireOperatorDashboardAuth, registerOperatorDashboardRoutes, resolveOperatorDashboardToken } from './operator/operator_dashboard.mjs';
import { createRequireAdminAuthorization, evaluateAdminAuthorization } from './scanner/admin_authorization.mjs';
import {
  ADMIN_SESSION_COOKIE_NAME,
  buildAdminSessionCookieClearOptions,
  buildAdminSessionCookieOptions,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from './scanner/admin_session.mjs';
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


import { getPaperBrokerNullAdapterDiagnostics } from './scanner/paper_broker_null_adapter.mjs';
import { getPaperBrokerAdapterContractDiagnostics } from './scanner/paper_broker_adapter_contract.mjs';
import { getPaperOrderIntentAdapterPreviewBridgeDiagnostics } from './scanner/paper_order_intent_adapter_preview_bridge.mjs';
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

app.get('/assets/customer-exit-notification-settings.js', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript');
  return res.sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/customer-exit-notification-settings.js');
});

app.get('/assets/eastern-market-time.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  return res.type('application/javascript').sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/eastern-market-time.js');
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

app.get('/assets/customer-market-countdown.js', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  return res.type('application/javascript').sendFile('/home/gemini/apps/gemini-scanner-backend/public/assets/customer-market-countdown.js');
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

    if (isHtml) {
      let html = alreadyUsesGlobalTheme ? body : injectGeminiScannerBrandHeader(body);
      if (!html.includes('/assets/eastern-market-time.js')) {
        const script = '<script src="/assets/eastern-market-time.js" defer></script>';
        html = /<\/body>/i.test(html)
          ? html.replace(/<\/body>/i, `${script}</body>`)
          : `${html}${script}`;
      }
      return originalSend(html);
    }
    return originalSend(body);
  };
  next();
});

const underFiveSharedCachePromise = import('./scanner/alpaca_under_five_shared_scan_cache.mjs')
  .then(async (mod) => {
    const cache = mod.createAlpacaUnderFiveSharedScanCache({
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
  });
    await cache.start();
    return cache;
  })
  .catch((error) => {
    console.error('[under-five-shared-cache] init failed', error?.message ?? String(error));
    return null;
  });

const premarketSharedCachePromise = import('./scanner/alpaca_premarket_shared_scan_cache.mjs')
  .then(async (mod) => {
    const baselineRuntime = await import('./scanner/premarket_capital_baseline_runtime.mjs');
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
      fetchCapitalBaseline: ({ now }) => baselineRuntime.collectPremarketCapitalBaseline({ now }),
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
  const current = cache.getLatest();
  const wakeRefreshRequired = refresh || !current || current?.idleNoDemand === true;
  cache.noteDemand?.();
  const source = wakeRefreshRequired
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

function adminCookieValue(req) {
  const raw = String(req.headers?.cookie ?? '');
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ADMIN_SESSION_COOKIE_NAME) return decodeURIComponent(rest.join('='));
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

async function fetchCustomerBrokerPerformanceEvidence(options = {}) {
  const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
  const historyFetch = await import('./scanner/paper_auto_execution_reporting_history_fetch.mjs');
  const historyAdapter = await import('./scanner/paper_auto_execution_reporting_history.mjs');
  const now = options.now instanceof Date ? options.now : new Date();
  const [fetchedPaperAccount, historicalOrderResult] = await Promise.all([
    options.fetchedPaperAccount
      ? Promise.resolve(options.fetchedPaperAccount)
      : accountData.fetchAlpacaPaperAccountReadonly(),
    historyFetch.fetchAlpacaPaperHistoricalOrdersReadonly(),
  ]);
  const adapted = historyAdapter.adaptAlpacaPaperFilledOrderHistory({
    historicalOrders: historicalOrderResult.historicalOrders,
  });
  return Object.freeze({
    fetchedPaperAccount,
    fillLedgerHistory: adapted.fillRecords,
    fillLedgerHistorySource: 'alpaca_paper_order_history',
    fillLedgerHistoryCompleteness: Object.freeze({
      historyLimit: historicalOrderResult.historyLimit,
      sourceRecordCount: historicalOrderResult.sourceRecordCount,
      historyLimitReached: historicalOrderResult.historyLimitReached,
      historyComplete: historicalOrderResult.historyComplete,
      historyPossiblyTruncated: historicalOrderResult.historyPossiblyTruncated,
    }),
    brokerObservationTs: now.toISOString(),
  });
}

async function buildCustomerBrokerPerformanceReport(options = {}) {
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
  const performanceMod = await import('./scanner/customer_zero_performance_report.mjs');
  const evidence = options.evidence ?? await fetchCustomerBrokerPerformanceEvidence({
    fetchedPaperAccount: options.fetchedPaperAccount,
    now: options.now,
  });
  const paperAccount = options.paperAccount ?? accountBridge.buildCustomerZeroPaperAccountBridge(evidence.fetchedPaperAccount);
  const performanceEpoch = options.performanceEpoch
    ?? (options.accountId ? getCustomerPerformanceEpoch(options.accountId) : Object.freeze({ ok: true, active: false, epoch: null }));
  if (performanceEpoch?.ok !== true) throw new Error(`customer_performance_epoch_unavailable:${performanceEpoch?.reason ?? 'unknown'}`);
  const performanceEpochStartedAt = performanceEpoch.active === true
    ? performanceEpoch.epoch?.startedAt ?? null
    : null;
  const performanceReport = performanceMod.buildCustomerZeroPerformanceReport({
    period: options.period,
    defaultPeriod: options.defaultPeriod,
    year: options.year,
    timeZone: options.timeZone,
    weekStartsOn: options.weekStartsOn,
    now: options.now,
    performanceEpochStartedAt,
    paperAccount,
    fillLedgerHistory: evidence.fillLedgerHistory,
    fillLedgerHistorySource: evidence.fillLedgerHistorySource,
    fillLedgerHistoryCompleteness: evidence.fillLedgerHistoryCompleteness,
    brokerObservationTs: evidence.brokerObservationTs,
  });
  return Object.freeze({ evidence, paperAccount, performanceEpoch, performanceReport });
}

async function buildAuthenticatedCustomerLifetimeEarningsBanner(account, reqPath = '', requestContext = null) {
  try {
    const bannerMod = await import('./scanner/customer_lifetime_earnings_banner.mjs');
    const clockMod = await import('./scanner/alpaca_market_clock_readonly.mjs');
    const now = new Date();
    const [brokerPerformance, marketClockResult] = await Promise.all([
      buildCustomerBrokerPerformanceReport({ accountId: account?.id, period: 'lifetime', defaultPeriod: 'lifetime', now }),
      clockMod.fetchAlpacaMarketClockReadonly(),
    ]);
    if (requestContext && typeof requestContext === 'object') {
      requestContext.fetchedPaperAccount = brokerPerformance.evidence.fetchedPaperAccount;
      requestContext.customerBrokerPerformanceEvidence = brokerPerformance.evidence;
    }
    return bannerMod.renderCustomerLifetimeEarningsBanner(brokerPerformance.performanceReport, {
      locale: account?.locale ?? 'en-US',
      detailed: reqPath === '/customer/portfolio' || reqPath === '/customer/reports',
      marketClock: marketClockResult?.marketClock ?? null,
    });
  } catch {
    const bannerMod = await import('./scanner/customer_lifetime_earnings_banner.mjs');
    return bannerMod.renderCustomerLifetimeEarningsBanner(null, { locale: account?.locale ?? 'en-US' });
  }
}

async function requireCustomerSession(req, res, next) {
  const secret = CUSTOMER_SESSION_SECRET
  const result = verifyCustomerSessionToken(customerCookieValue(req), {
    secret,
    authenticatorMasterKey: process.env.CUSTOMER_AUTHENTICATOR_MASTER_KEY,
  });
  if (!result.ok) return res.redirect(303, '/login');
  req.customerAccount = result.account;

  const bannerMod = await import('./scanner/customer_lifetime_earnings_banner.mjs');
  const requestContext = {};
  const bannerHtml = await buildAuthenticatedCustomerLifetimeEarningsBanner(result.account, req.path, requestContext);
  req.customerPaperAccountFetch = requestContext.fetchedPaperAccount ?? null;
  req.customerBrokerPerformanceEvidence = requestContext.customerBrokerPerformanceEvidence ?? null;
  const originalSend = res.send.bind(res);
  res.send = (body) => {
    const contentType = String(res.getHeader('Content-Type') ?? '');
    const htmlResponse = typeof body === 'string'
      && (contentType.includes('text/html') || /<!doctype html|<html\qb||<body\b/i.test(body));
    return originalSend(htmlResponse
      ? bannerMod.injectCustomerLifetimeEarningsBanner(body, bannerHtml)
      : body);
  };
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
<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required>
</label>
<label>Confirm new password
<input name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required>
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
      ? 'New password must be at least 8 characters.'
      : changed.reason === 'new_password_must_differ'
        ? 'New password must differ from the current password.'
        : 'Password could not be reset.';
    return res.status(400).type('html').send(customerResetPasswordHtml(token, message));
  }

  recordCustomerSecurityAudit(req, 'password_reset', 'success', undefined, verified.accountId);
  markCustomerPasswordResetConsumed(record.tokenHash);
  res.clearCookie(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions());
  return res.status(200).type('html').send(renderThemedStatusPage({
    surface: 'public',
    title: 'Password reset complete',
    message: 'Your password has been updated. Sign in with your new password.',
    href: '/login',
    linkLabel: 'Continue to sign in',
  }));
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



// Paper app lifecycle diagnostic aliases.
// Read-only JSON/panel mirrors for app screens already backed by server routes.
const PAPER_APP_LIFECYCLE_DIAGNOSTIC_ALIASES = Object.freeze([
  { route: '/diagnostics/paper-lifecycle-dashboard', module: './scanner/paper_lifecycle_readonly_dashboard_panel.mjs', build: 'buildPaperLifecycleReadOnlyDashboardPanel' }
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
  { route: '/diagnostics/paper-order-readonly-status', module: './scanner/paper_order_readonly_status_app_screen.mjs', build: 'buildPaperOrderReadonlyStatusAppScreen', args: [{ panel: fastReadonlyAppPanel('Paper Order Read-Only Status') }] },
  { route: '/diagnostics/paper-trading-overview-status', module: './scanner/paper_trading_overview_status_app_screen.mjs', build: 'buildPaperTradingOverviewStatusAppScreen' }
]);

const PAPER_APP_NONLIFECYCLE_REDIRECT_DIAGNOSTIC_ALIASES = Object.freeze([
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


const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';

if (!app.__geminiOperatorDashboardRoutesRegistered) {
  registerOperatorDashboardRoutes(app);
}

const requireInternalOwnerAuth = createRequireOperatorDashboardAuth();
const requireInternalOwnerAuthorization = createRequireInternalOwnerAuthorization();
const requireInternalOwnerTenantIsolation = createRequireInternalOwnerTenantIsolation();
const requireAdminTokenAuthorization = createRequireAdminAuthorization();
const adminLoginRateLimiter = createAdminLoginRateLimiter();

function adminLoginHtml(message = '') {
  const notice = message
    ? `<div class="notice" role="status">${String(message).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin sign in · GeminiScanner</title>
${renderGlobalThemeCss({ surface: 'public' })}
<style>
main{min-height:calc(100vh - 132px);display:grid;place-items:center;padding:34px 18px 64px}
.auth-card{width:min(100%,500px);padding:28px}
h1{margin:0 0 10px;font-size:clamp(32px,8vw,46px);letter-spacing:-.035em}
.sub{margin:0 0 24px;color:var(--gs-muted);line-height:1.55}
form{display:grid;gap:16px}
label{display:grid;gap:8px;font-weight:800}
input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid var(--gs-line);background:var(--gs-panel);color:var(--gs-text);font:inherit}
button{width:100%;padding:14px 18px}
.links{margin:20px 0 0;text-align:center}
.notice{margin:0 0 18px;padding:12px 14px;border:1px solid rgba(255,184,77,.45);border-radius:12px;background:rgba(84,55,5,.34);color:#ffe8bd}
</style>
</head>
<body data-gs-page="admin-login">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'public', homeHref: '/', label: 'GeminiScanner Admin' })}
<main><section class="card auth-card">
<h1>Admin sign in</h1>
<p class="sub">Enter your GeminiScanner admin password. Admin sessions are isolated from customer accounts.</p>
${notice}
<form method="post" action="/admin/login">
<label>Admin password
<input type="password" name="password" autocomplete="current-password" required>
</label>
<button type="submit">Sign in as admin</button>
</form>
<p class="links"><a href="/">Return to GeminiScanner</a></p>
</section></main>
${renderGlobalFooter()}
</body>
</html>`;
}

function requireAdminAuthorization(req, res, next) {
  const sessionSecret = resolveOperatorDashboardToken();
  const session = verifyAdminSessionToken(adminCookieValue(req), { secret: sessionSecret });
  if (session.ok) {
    req.adminAuthorization = Object.freeze({
      role: 'admin',
      policy: 'admin_browser_session_v1',
      subject: session.subject,
    });
    return next();
  }
  return requireAdminTokenAuthorization(req, res, next);
}

app.get('/admin/login', (req, res) => {
  const sessionSecret = resolveOperatorDashboardToken();
  const session = verifyAdminSessionToken(adminCookieValue(req), { secret: sessionSecret });
  if (session.ok) return res.redirect(303, '/admin');
  res.set('Cache-Control', 'no-store');
  const message = String(req.query?.passwordChanged ?? '') === '1'
    ? 'Admin password changed successfully. Sign in with your new password.'
    : '';
  return res.status(200).type('html').send(adminLoginHtml(message));
});

app.post('/admin/login', requireCustomerSameOrigin, (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (adminLoginRateLimiter.isLimited(req)) {
    res.set('Retry-After', '900');
    return res.status(429).type('html').send(adminLoginHtml('Too many admin sign-in attempts. Try again later.'));
  }

  const decision = evaluateAdminPassword(req.body?.password);
  if (!decision.allowed) {
    const message = decision.reason === 'admin_password_disabled'
      ? 'Admin password login is not configured.'
      : 'Admin password is incorrect.';
    return res.status(decision.reason === 'admin_password_disabled' ? 503 : 401).type('html').send(adminLoginHtml(message));
  }

  const sessionSecret = resolveOperatorDashboardToken();
  const token = createAdminSessionToken({
    secret: sessionSecret,
    subject: 'owner',
  });
  adminLoginRateLimiter.clear(req);
  res.cookie(ADMIN_SESSION_COOKIE_NAME, token, buildAdminSessionCookieOptions());
  return res.redirect(303, '/admin');
});

app.post('/admin/logout', requireCustomerSameOrigin, (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, buildAdminSessionCookieClearOptions());
  return res.redirect(303, '/admin/login');
});

function adminSecurityHtml(message = '', error = false) {
  const notice = message ? `<div class="${error ? 'error' : 'notice'}">${escapeThemedStatusHtml(message)}</div>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Security · GeminiScanner</title>${renderGlobalThemeCss()}
<style>
.admin-security-card { max-width: 720px; }
.admin-security-form { display: flex; flex-direction: column; gap: 14px; }
.admin-security-label { display: block; font-weight: 700; }
.admin-security-label span { display: block; margin: 0 0 8px; }
.admin-security-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 14px;
  border: 2px solid rgba(255,255,255,0.75);
  background: rgba(0,16,24,0.92);
  color: #ffffff;
}
.admin-security-input:focus {
  outline: none;
  border-color: #39d1ff;
  box-shadow: 0 0 0 3px rgba(57,209,255,0.18);
}
.admin-security-submit { width: 100%; }
.admin-security-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
}
.admin-security-toggle input { width: 18px; height: 18px; }
@media (max-width: 640px) {
  .admin-security-card { padding: 24px 18px; }
}

/* Admin responsive viewport repair */
html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
body { margin: 0; }
main { width: min(100%, 1600px); max-width: none; box-sizing: border-box; margin-inline: auto; padding-inline: clamp(14px, 2.5vw, 36px); }
main > * { min-width: 0; }
.card, .panel, section, article { max-width: 100%; box-sizing: border-box; }
table { max-width: 100%; }
.table-wrap, .table-scroll, .admin-table-wrap { width: 100%; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
@media (max-width: 900px) { main { width: 100%; padding-inline: 14px; } .card, .panel, section, article { width: 100%; max-width: 100%; } }
@media (orientation: landscape) and (max-height: 700px) and (min-width: 600px) { main { width: 100%; padding-inline: 18px; } }
.admin-action { display:inline-block; background:#00ffff; color:#000; border:1px solid #00ffff; border-radius:10px; padding:10px 14px; font-weight:800; text-decoration:none; }
</style></head>
<body>${renderBackgroundLogoLayer()}${renderGlobalHeader({ surface: 'admin', homeHref: '/admin', label: 'GeminiScanner Admin' })}
<main><section class="card auth-card admin-security-card"><h1>Admin Security</h1>
<p class="sub">Change the password used for GeminiScanner administrator sign in.</p>${notice}
<form class="admin-security-form" method="post" action="/admin/security/password">
<label class="admin-security-label"><span>Current admin password</span><input class="admin-security-input" type="password" name="currentPassword" autocomplete="current-password" required></label>
<label class="admin-security-label"><span>New admin password</span><input class="admin-security-input" type="password" name="newPassword" autocomplete="new-password" required></label>
<label class="admin-security-label"><span>Confirm new admin password</span><input class="admin-security-input" type="password" name="confirmPassword" autocomplete="new-password" required></label>
<label class="admin-security-toggle"><input type="checkbox" data-show-passwords> Show passwords</label>
<button class="admin-security-submit" type="submit">Change admin password</button></form>
<p class="sub">Changing the password signs out existing admin browser sessions.</p>
<p><a class="admin-action" href="/admin">Back to Admin Dashboard</a></p></section></main>
<script src="/assets/password-visibility.js" defer></script></body></html>`;
}

app.get('/admin/security', requireAdminAuthorization, (req, res) => {
  return res.type('html').send(adminSecurityHtml());
});

app.post('/admin/security/password', requireAdminAuthorization, requireCustomerSameOrigin, (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '');
  const newPassword = String(req.body?.newPassword ?? '');
  const confirmPassword = String(req.body?.confirmPassword ?? '');

  if (!evaluateAdminPassword(currentPassword).allowed) {
    return res.status(401).type('html').send(adminSecurityHtml('Current admin password is incorrect.', true));
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).type('html').send(adminSecurityHtml('New password and confirmation do not match.', true));
  }
  if (!isStrongAdminPassword(newPassword)) {
    return res.status(400).type('html').send(adminSecurityHtml('New admin password must be at least 12 characters and cannot be an obvious weak password.', true));
  }

  const envPath = path.join(process.cwd(), '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const lines = envText.split(/\r?\n/);
  const serializedAdminPassword = JSON.stringify(newPassword);
  const parsedAdminPassword = dotenv.parse(`ADMIN_PASSWORD=${serializedAdminPassword}\n`).ADMIN_PASSWORD;
  if (parsedAdminPassword !== newPassword) {
    return res.status(400).type('html').send(adminSecurityHtml('That password cannot be stored safely. Choose a different password.', true));
  }
  const next = [];
  let replaced = false;
  for (const line of lines) {
    if (line.startsWith('ADMIN_PASSWORD=')) {
      if (!replaced) {
        next.push(`ADMIN_PASSWORD=${serializedAdminPassword}`);
        replaced = true;
      }
      continue;
    }
    next.push(line);
  }
  if (!replaced) next.push(`ADMIN_PASSWORD=${serializedAdminPassword}`);
  const tempPath = `${envPath}.admin-password-change.tmp`;
  const normalized = next.filter((line, index, all) => !(index === all.length - 1 && line === '')).join('\n') + '\n';
  fs.writeFileSync(tempPath, normalized, { mode: 0o600 });
  fs.chmodSync(tempPath, 0o600);
  fs.renameSync(tempPath, envPath);
  fs.chmodSync(envPath, 0o600);

  const sessionTokenPath = '/home/gemini/.gemini-scanner-operator-token';
  const rotatedSessionSecret = randomBytes(32).toString('hex');
  fs.writeFileSync(sessionTokenPath, `${rotatedSessionSecret}\n`, { mode: 0o600 });
  fs.chmodSync(sessionTokenPath, 0o600);

  process.env.ADMIN_PASSWORD = newPassword;
  res.clearCookie(ADMIN_SESSION_COOKIE_NAME, buildAdminSessionCookieClearOptions());
  return res.redirect(303, '/admin/login?passwordChanged=1');
});

function readAdminLocalJsonStatus(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return null; }
}

app.get('/admin', requireAdminAuthorization, async (_req, res) => {
  const mod = await import('./scanner/admin_surface.mjs');
  const accessMod = await import('./scanner/alpaca_master_access_switch.mjs');
  const healthMod = await import('./scanner/admin_system_health.mjs');
  const tradingMod = await import('./scanner/admin_trading_engine.mjs');
  const [alpacaAccess, systemHealth] = await Promise.all([accessMod.getAlpacaMasterAccessSwitchState(), healthMod.collectAdminSystemHealth()]);
  const automaticPaper = {
    continuity: paperAutoExecutionContinuityRuntime.diagnostics(),
    enter: paperAutoExecutionContinuityEnterRunner.diagnostics(),
    scale: paperAutoExecutionScaleRunner.diagnostics(),
    exit: paperAutoExitMonitorWorker.diagnostics(),
    degradedBroker: paperAutoExecutionDegradedBrokerMode.diagnostics(),
    readiness: readAdminLocalJsonStatus('runs/execution_readiness_watcher_status.json'),
    assurance: readAdminLocalJsonStatus('runs/paper_auto_execution_execution_assurance_watchdog_status.json'),
    lifecycle: paperAutoExecutionContinuityRuntime.diagnostics()?.lastLifecycle ?? null,
    activation: {
      paperTrading: String(process.env.ALPACA_PAPER_TRADING ?? '').trim().toLowerCase() === 'true',
      paperBaseUrl: String(process.env.APCA_API_BASE_URL ?? '').trim(),
      continuityEnabled: String(process.env.PAPER_AUTO_CONTINUITY_ENABLED ?? '').trim() === '1',
      continuityEnterEnabled: String(process.env.PAPER_AUTO_CONTINUITY_ENTER_ENABLED ?? '').trim() === '1',
      scaleRunnerEnabled: String(process.env.PAPER_AUTO_SCALE_RUNNER_ENABLED ?? '').trim() === '1',
      scaleInEnabled: String(process.env.PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED ?? '').trim() === '1',
      scaleOutEnabled: String(process.env.PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED ?? '').trim() === '1',
      exitMonitorEnabled: String(process.env.PAPER_AUTO_EXIT_MONITOR_ENABLED ?? '').trim() === '1',
      liveTradingAllowed: false,
    },
    safety: { paperOnly: true, liveTradingAllowed: false, adminExecutionControls: false },
  };
  const tradingEngine = tradingMod.collectAdminTradingEngine({ alpacaAccess, systemHealth, automaticPaper });
  const surface = mod.buildAdminSurface({ alpacaAccess, systemHealth, tradingEngine });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderAdminSurfaceHtml(surface));
});


app.get('/admin/customer-intelligence', requireAdminAuthorization, async (_req, res) => {
  const [adminMod, freshnessMod] = await Promise.all([
    import('./scanner/admin_customer_intelligence.mjs'),
    import('./scanner/customer_scanner_freshness_diagnostic.mjs'),
  ]);
  const underFiveCache = await underFiveSharedCachePromise;
  const rawSource = underFiveCache?.getLatest?.() ?? null;
  const cacheDiagnostics = underFiveCache?.getDiagnostics?.() ?? null;
  const rankingRoot = rawSource ? readUnderFiveLiveRankings(rawSource) : {};
  const scannerSource = rawSource
    ? bridgeCustomerZeroFreshRankings(rawSource, rankingRoot, getStreamTelemetry())
    : {
        status: 'unavailable',
        sourceStatus: 'unavailable',
        candidates: [],
        candidateCount: 0,
        runtimeHealth: { degraded: true, issues: ['UNDER_FIVE_SHARED_CACHE_UNAVAILABLE'], readOnly: true, executionAllowed: false },
        rankingBridge: { connected: false, stale: true, issues: ['UNDER_FIVE_SHARED_CACHE_UNAVAILABLE'], readOnly: true, executionAllowed: false },
      };
  const scannerFreshness = freshnessMod.buildCustomerScannerFreshnessDiagnostic({
    cacheDiagnostics,
    rankingRoot,
    streamTelemetry: getStreamTelemetry(),
  });
  const premarketCache = await premarketSharedCachePromise;
  const premarket = premarketCache?.getDiagnostics?.() ?? null;
  const model = adminMod.buildAdminCustomerIntelligence({
    scannerSource,
    scannerFreshness,
    premarket,
    performance: null,
  });
  res.set('Cache-Control', 'no-store');
  return res.status(200).type('html').send(adminMod.renderAdminCustomerIntelligence(model));
});

app.get('/admin/system-health', requireAdminAuthorization, async (_req, res) => { const m = await import('./scanner/admin_system_health.mjs'); const x = await m.collectAdminSystemHealth(); res.set('Cache-Control','no-store'); return res.status(200).type('html').send(m.renderAdminSystemHealth(x)); });

app.get('/admin/trading-engine', requireAdminAuthorization, async (_req, res) => {
  const m = await import('./scanner/admin_trading_engine.mjs');
  const accessMod = await import('./scanner/alpaca_master_access_switch.mjs');
  const alpacaAccess = await accessMod.getAlpacaMasterAccessSwitchState();
  const automaticPaper = {
    continuity: paperAutoExecutionContinuityRuntime.diagnostics(),
    enter: paperAutoExecutionContinuityEnterRunner.diagnostics(),
    scale: paperAutoExecutionScaleRunner.diagnostics(),
    exit: paperAutoExitMonitorWorker.diagnostics(),
    degradedBroker: paperAutoExecutionDegradedBrokerMode.diagnostics(),
    readiness: readAdminLocalJsonStatus('runs/execution_readiness_watcher_status.json'),
    assurance: readAdminLocalJsonStatus('runs/paper_auto_execution_execution_assurance_watchdog_status.json'),
    lifecycle: paperAutoExecutionContinuityRuntime.diagnostics()?.lastLifecycle ?? null,
    activation: {
      paperTrading: String(process.env.ALPACA_PAPER_TRADING ?? '').trim().toLowerCase() === 'true',
      paperBaseUrl: String(process.env.APCA_API_BASE_URL ?? '').trim(),
      continuityEnabled: String(process.env.PAPER_AUTO_CONTINUITY_ENABLED ?? '').trim() === '1',
      continuityEnterEnabled: String(process.env.PAPER_AUTO_CONTINUITY_ENTER_ENABLED ?? '').trim() === '1',
      scaleRunnerEnabled: String(process.env.PAPER_AUTO_SCALE_RUNNER_ENABLED ?? '').trim() === '1',
      scaleInEnabled: String(process.env.PAPER_AUTO_SCALE_IN_SUBMISSION_ENABLED ?? '').trim() === '1',
      scaleOutEnabled: String(process.env.PAPER_AUTO_SCALE_OUT_SUBMISSION_ENABLED ?? '').trim() === '1',
      exitMonitorEnabled: String(process.env.PAPER_AUTO_EXIT_MONITOR_ENABLED ?? '').trim() === '1',
      liveTradingAllowed: false,
    },
    safety: { paperOnly: true, liveTradingAllowed: false, adminExecutionControls: false },
  };
  const x = m.collectAdminTradingEngine({ alpacaAccess, automaticPaper });
  res.set('Cache-Control','no-store');
  return res.status(200).type('html').send(m.renderAdminTradingEngine(x));
});

app.get('/admin/api/companion/status', requireAdminAuthorization, async (_req, res) => {
  const [healthMod, tradingMod, accessMod, companionMod] = await Promise.all([
    import('./scanner/admin_system_health.mjs'),
    import('./scanner/admin_trading_engine.mjs'),
    import('./scanner/alpaca_master_access_switch.mjs'),
    import('./scanner/admin_companion_api.mjs'),
  ]);
  const [systemHealth, alpacaAccess] = await Promise.all([
    healthMod.collectAdminSystemHealth(),
    accessMod.getAlpacaMasterAccessSwitchState(),
  ]);
  const tradingEngine = tradingMod.collectAdminTradingEngine({ alpacaAccess });
  const fs = await import('node:fs');
  const readLastJsonl = (file) => {
    try {
      const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
      return lines.length ? JSON.parse(lines.at(-1)) : null;
    } catch {
      return null;
    }
  };
  const infrastructureIncident = readLastJsonl('runs/infrastructure_website_watchdog_incidents.jsonl');
  const opsAiIncident = readLastJsonl('runs/ops_ai_scanner_watchdog_incidents.jsonl')
    || readLastJsonl('runs/ops_ai_scanner_watchdog_incident_ledger.jsonl');
  const operationalIncident = readLastJsonl('runs/admin_operational_incidents.jsonl');
  const alertPolicyMod = await import('./scanner/admin_incident_alert_policy.mjs');
  const payload = companionMod.buildAdminCompanionStatus({
    systemHealth,
    tradingEngine,
    infrastructureIncident,
    opsAiIncident,
    operationalIncident,
  });
  const alerts = alertPolicyMod.buildAdminIncidentAlertSummary({
    infrastructureIncident,
    opsAiIncident,
  });
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ ...payload, alerts });
});

app.post('/admin/alpaca-access', requireAdminAuthorization, requireCustomerSameOrigin, async (req, res) => {
  const accessMod = await import('./scanner/alpaca_master_access_switch.mjs');
  const enabled = String(req.body?.enabled ?? '').trim() === '1';
  await accessMod.setAlpacaMasterAccessSwitchState({
    enabled,
    updatedBy: 'admin',
    reason: enabled
      ? 'admin_enabled_alpaca_read_access'
      : 'admin_disabled_alpaca_read_access',
  });
  res.redirect(303, '/admin');
});









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

app.get("/diagnostics/premarket-runtime", async (_req, res) => {
  const premarketCache = await premarketSharedCachePromise;
  res.set("Cache-Control", "no-store");
  res.json({
    status: premarketCache?.getDiagnostics?.() ?? null,
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

app.get("/diagnostics/post-market-runtime", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json(postMarketRuntimeWorker.getStatus());
});

app.get("/diagnostics/customer-report-background-ai-review", (_req, res) => {
  res.set("Cache-Control", "no-store");
  const worker = customerReportBackgroundAiReviewWorker.getStatus();
  const history = listCustomerReportBackgroundAiReviewRecords({ maxRecords: 20 });
  const latestRecord = history.records?.[0] ?? null;
  res.json({
    version: worker?.version ?? history.version ?? null,
    enabled: worker?.enabled ?? null,
    running: worker?.running ?? null,
    runCount: worker?.runCount ?? null,
    lastRunAt: worker?.lastRunAt ?? null,
    lastCompletedAt: worker?.lastCompletedAt ?? null,
    lastStatus: worker?.lastStatus ?? worker?.status ?? null,
    lastError: worker?.lastError ?? null,
    latestRecord,
    worker,
    history,
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

app.get("/diagnostics/app-navigation-readonly", (req, res) => {
  res.json(buildAppNavigationReadonly({ now: new Date() }));
});

app.get("/app", (req, res) => {
  res.type("html").send(renderAppNavigationReadonlyHtml(buildAppNavigationReadonly({ now: new Date() })));
});


const paperPositionStateAutoRefresh = createPaperTradePositionStateAutoRefresh();
const configuredPaperAutoExecutionLifecycleFile = String(
  process.env.PAPER_AUTO_EXIT_MONITOR_LIFECYCLE_PATH
  ?? process.env.PAPER_AUTO_EXECUTION_LIFECYCLE_PATH
  ?? ''
).trim();
let activePaperAutoExecutionLifecycleFile = resolvePaperAutoExecutionActiveLifecycleFile({
  pointerFile: PAPER_AUTO_EXECUTION_ACTIVE_LIFECYCLE_POINTER_FILE,
  configuredLifecycleFile: configuredPaperAutoExecutionLifecycleFile,
});

const getPaperAutoExecutionContinuityScanSnapshot = async () => {
  const cache = await underFiveSharedCachePromise;
  if (!cache) return { candidates: [] };
  const current = cache.getLatest?.();
  const wakeRefreshRequired = !current || current?.idleNoDemand === true;
  cache.noteDemand?.();
  const source = wakeRefreshRequired ? await cache.refreshNow() : current;
  const rankingRoot = readUnderFiveLiveRankings(source);
  const customerSource = bridgeCustomerZeroFreshRankings(
    source,
    rankingRoot,
    getStreamTelemetry(),
  );
  const reentrySourceAgeSec = rankingRoot?.sourceAgeSec === null || rankingRoot?.sourceAgeSec === undefined || String(rankingRoot.sourceAgeSec).trim() === '' ? null : Number(rankingRoot.sourceAgeSec);
  const reentryMaxAgeSec = rankingRoot?.maxAgeSec === null || rankingRoot?.maxAgeSec === undefined || String(rankingRoot.maxAgeSec).trim() === '' ? null : Number(rankingRoot.maxAgeSec);
  const reentryConnected = Array.isArray(rankingRoot?.rankings) && rankingRoot.rankings.length > 0;
  const reentryFresh = reentryConnected
    && rankingRoot?.stale === false
    && Number.isFinite(reentrySourceAgeSec)
    && Number.isFinite(reentryMaxAgeSec)
    && reentrySourceAgeSec >= 0
    && reentryMaxAgeSec > 0
    && reentrySourceAgeSec <= reentryMaxAgeSec;
  return {
    observedAt: source?.sharedCache?.generatedAt ?? source?.generatedAt ?? null,
    reentryControl: {
      connected: reentryConnected,
      fresh: reentryFresh,
      stale: !reentryFresh,
      sourceAgeSec: Number.isFinite(reentrySourceAgeSec) ? reentrySourceAgeSec : null,
      maxAgeSec: Number.isFinite(reentryMaxAgeSec) ? reentryMaxAgeSec : null,
      cooldownState: rankingRoot?.cooldownState ?? null,
      resetPermission: rankingRoot?.resetPermission ?? null,
      reentryPermission: rankingRoot?.reentryPermission ?? null,
      continuationPermission: rankingRoot?.continuationPermission ?? null,
      riskRestartState: rankingRoot?.riskRestartState ?? null,
      restartPermission: rankingRoot?.restartPermission ?? null,
    },
    candidates: (Array.isArray(customerSource?.candidates) ? customerSource.candidates : []).map((candidate) => {
      const state = String(candidate?.resultState ?? candidate?.decision ?? 'NO_SETUP').trim().toUpperCase();
      const strategyAuthorization = authorizePaperAutoExecutionCandidate({
        ...candidate,
        state,
      });
      const blockers = [
        ...(Array.isArray(candidate?.blockingFlags) ? candidate.blockingFlags : []),
        ...(Array.isArray(candidate?.staleReasons) ? candidate.staleReasons : []),
        ...(Array.isArray(strategyAuthorization?.blockers) ? strategyAuthorization.blockers : []),
      ];
      return {
        ...candidate,
        state,
        strategyAuthorization,
        buyRecommendation: strategyAuthorization.authorized === true,
        blocked: strategyAuthorization.authorized !== true,
        blockers: [...new Set(blockers)],
        score: Number(candidate?.readonlyPotentialScore),
      };
    }),
  };
};
const paperAutoExecutionDegradedBrokerMode = createPaperAutoExecutionDegradedBrokerMode({ env: process.env });
const runPaperAutoExecutionDegradedBrokerRecoveryProbe = async () => {
  const before = paperAutoExecutionDegradedBrokerMode.diagnostics();
  if (before?.enabled !== true || before?.status?.degraded !== true) return before;
  const [account, clock] = await Promise.all([
    fetchAlpacaPaperAccountReadonly({ credentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials }),
    fetchAlpacaMarketClockReadonly({ credentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials }),
  ]);
  if (account?.ok !== true || account?.status !== 'connected_readonly') return paperAutoExecutionDegradedBrokerMode.diagnostics();
  if (clock?.ok !== true || clock?.status !== 'connected_readonly') return paperAutoExecutionDegradedBrokerMode.diagnostics();
  if (account?.account?.tradingBlocked === true || account?.account?.accountBlocked === true) return paperAutoExecutionDegradedBrokerMode.diagnostics();
  const accountObservedAt = String(account?.observedAt ?? '').trim();
  const clockObservedAt = String(clock?.marketClock?.timestamp ?? '').trim();
  if (!accountObservedAt || !clockObservedAt) return paperAutoExecutionDegradedBrokerMode.diagnostics();
  return paperAutoExecutionDegradedBrokerMode.recordSuccess({
    probeId: `runtime-readonly:${accountObservedAt}:${clockObservedAt}`,
  });
};
const paperAutoExecutionContinuityRuntime = createPaperAutoExecutionContinuityRuntime({
  getActiveLifecycleFile: () => activePaperAutoExecutionLifecycleFile,
  setActiveLifecycleFile: (file) => {
    const nextLifecycleFile = String(file ?? '').trim();
    writePaperAutoExecutionActiveLifecyclePointer({
      lifecycleFile: nextLifecycleFile,
      pointerFile: PAPER_AUTO_EXECUTION_ACTIVE_LIFECYCLE_POINTER_FILE,
    });
    activePaperAutoExecutionLifecycleFile = nextLifecycleFile;
  },
  getScanSnapshot: getPaperAutoExecutionContinuityScanSnapshot,
});
const paperAutoExecutionContinuityEnterRunner = createPaperAutoExecutionContinuityEnterRunner({
  getLifecycleFile: () => activePaperAutoExecutionLifecycleFile,
  getScanSnapshot: getPaperAutoExecutionContinuityScanSnapshot,
  getPremarketBaseline: () => getPersistedPremarketCapitalBaseline({ now: new Date() }),
  accountCredentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials,
  degradedBrokerMode: paperAutoExecutionDegradedBrokerMode,
});

const PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH = 'runs/paper_auto_execution_execution_assurance_incidents.jsonl';
let paperAutoExecutionExecutionAssuranceLastReport = Object.freeze({
  version: 'paper_auto_execution_execution_assurance_v3',
  generatedAt: null,
  healthy: true,
  status: 'not_evaluated',
  failureCodes: Object.freeze([]),
  marketOpen: false,
  checks: Object.freeze({}),
  thresholds: Object.freeze({}),
  safety: Object.freeze({
    readOnly: true,
    paperOnly: true,
    remediationAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    strategyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    aiAuthorityMutationAllowed: false,
    blindResubmissionAllowed: false,
    liveTradingAllowed: false,
  }),
});
let paperAutoExecutionExecutionAssuranceLastIncident = null;

const readActivePaperAutoExecutionLifecycleReadonly = () => {
  const file = String(activePaperAutoExecutionLifecycleFile ?? '').trim();
  if (!file || !fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const runPaperAutoExecutionExecutionAssurance = async ({ marketOpen = false } = {}) => {
  const report = evaluatePaperAutoExecutionExecutionAssurance({
    marketOpen,
    continuity: paperAutoExecutionContinuityRuntime.diagnostics(),
    enter: paperAutoExecutionContinuityEnterRunner.diagnostics(),
    lifecycle: readActivePaperAutoExecutionLifecycleReadonly(),
  });
  paperAutoExecutionExecutionAssuranceLastReport = report;

  const failureCodes = Array.isArray(report?.failureCodes) ? report.failureCodes : [];
  let previousIncidentRecord = paperAutoExecutionExecutionAssuranceLastIncident?.incident ?? null;
  if (!previousIncidentRecord) {
    const incidentRouterMod = await import('./scanner/admin_operational_incident_router.mjs');
    previousIncidentRecord = incidentRouterMod.readLatestAdminOperationalIncident({
      ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
    });
  }
  const previousOpen = previousIncidentRecord?.open === true;
  const failedRecoveryNotification =
    previousIncidentRecord?.status === 'recovered' &&
    previousIncidentRecord?.delivery?.delivered !== true;

  if (report?.healthy === false) {
    const incidentMod = await import('./scanner/admin_paper_operational_incident_emitter.mjs');
    paperAutoExecutionExecutionAssuranceLastIncident = await incidentMod.emitAdminPaperOperationalIncident({
      source: 'paper_execution',
      category: 'paper_execution_assurance',
      severity: 'critical',
      failureCodes,
      summary: 'Automatic PAPER execution assurance detected a defined critical-path failure.',
      phase: 'execution_assurance',
      route: '/diagnostics/paper-auto-execution-execution-assurance',
      process: 'gemini-scanner',
    }, {
      ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
    });
  } else if (previousOpen || failedRecoveryNotification) {
    const incidentMod = await import('./scanner/admin_paper_operational_incident_emitter.mjs');
    paperAutoExecutionExecutionAssuranceLastIncident = await incidentMod.emitAdminPaperOperationalIncident({
      source: 'paper_execution',
      category: 'paper_execution_assurance',
      severity: 'recovery',
      failureCodes: previousIncidentRecord?.failureCodes ?? ['EXECUTION_ASSURANCE_RECOVERED'],
      summary: 'Automatic PAPER execution assurance recovered.',
      phase: 'execution_assurance',
      route: '/diagnostics/paper-auto-execution-execution-assurance',
      process: 'gemini-scanner',
    }, {
      ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
    });
  }

  return Object.freeze({
    report,
    incident: paperAutoExecutionExecutionAssuranceLastIncident,
    ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
    notificationSendAuthorized: paperAutoExecutionExecutionAssuranceLastIncident?.notificationSendAuthorized === true,
    readOnly: true,
    remediationAllowed: false,
  });
};
const paperAutoExecutionScaleSubmit=async(o,c)=>{
 const r=await resolveInternalOwnerAlpacaReadonlyCredentials({masterKey:process.env.GEMINI_CREDENTIAL_MASTER_KEY});
 if(r?.readyForReadonlyBrokerRead!==true)throw Error('paper_scale_runtime_credentials_required');
 return createPaperAutoExecutionAlpacaPaperAdapter({env:{...process.env,...r.env,PAPER_AUTO_ALPACA_ADAPTER_ENABLED:'1',PAPER_AUTO_ALPACA_PAPER_BASE_URL:'https://paper-api.alpaca.markets'}}).submitPaperOrder(o,c);
};

const getPaperAutoExecutionOwnedMonitor=async({paperAccount,nowMs=Date.now()}={})=>{
 let capitalProtectionRoot=null;
 try{
  const cache=await underFiveSharedCachePromise;
  const current=cache?.getLatest?.();
  const wake=!current||current?.idleNoDemand===true;
  cache?.noteDemand?.();
  const source=cache?(wake?await cache.refreshNow():current):null;
  capitalProtectionRoot=source?readUnderFiveLiveRankings(source):null;
 }catch{}
 return fetchCustomerOwnedPositionMonitorSource({paperAccount,fetchSymbols:a=>fetchAlpacaUnderFiveUniverseReadonly({...a,credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials}),nowMs,maxAssets:1,capitalProtectionRoot});
};

const paperAutoExecutionScaleRunner=createPaperAutoExecutionScaleRunner({
 getLifecycleFile:()=>activePaperAutoExecutionLifecycleFile,
 fetchAccount:()=>fetchAlpacaPaperAccountReadonly({credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials}),
 fetchMarketClock:()=>fetchAlpacaMarketClockReadonly({credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials}),
 fetchOwnedMonitor:getPaperAutoExecutionOwnedMonitor,
 getPremarketBaseline:()=>getPersistedPremarketCapitalBaseline({now:new Date()}),
 fetchOrderByClientOrderId:({clientOrderId})=>fetchAlpacaPaperOrderByClientOrderIdReadonly({clientOrderId,credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials}),
 submitPaperOrder:paperAutoExecutionScaleSubmit,serverIntegrated:true,automaticStartAllowed:true,
 degradedBrokerMode:paperAutoExecutionDegradedBrokerMode,
});

const runPaperAutoExecutionScaleCycle=async(source='runtime')=>{try{
 const f=String(activePaperAutoExecutionLifecycleFile??'').trim();if(!f||!fs.existsSync(f))return paperAutoExecutionScaleRunner.diagnostics();
 let l;try{l=JSON.parse(fs.readFileSync(f,'utf8'))}catch{return paperAutoExecutionScaleRunner.diagnostics()}if(l?.state!=='MONITORING')return paperAutoExecutionScaleRunner.diagnostics();
 const q=new PaperAutoExecutionScaleActionStore({filePath:derivePaperScaleActionFile(f)});if(q.mutationLocked())return paperAutoExecutionScaleRunner.runOnce();
 const a=await fetchAlpacaPaperAccountReadonly({credentialResolver:resolveInternalOwnerAlpacaReadonlyCredentials});if(a?.ok!==true||a?.status!=='connected_readonly')return paperAutoExecutionScaleRunner.diagnostics();
 const m=await getPaperAutoExecutionOwnedMonitor({paperAccount:a,nowMs:Date.now()});
 const s=String(l.selectedSymbol??'').trim().toUpperCase(),c=(m?.candidates??[]).find(x=>String(x?.symbol??'').trim().toUpperCase()===s);if(!c)return paperAutoExecutionScaleRunner.diagnostics();
 if(c.ownedExitReviewTriggered===true||String(c.resultState??c.decision??'').trim().toUpperCase()==='EXIT')return paperAutoExecutionScaleRunner.diagnostics();
 const o=Number(c.ownedScaleOutResultingQuantity);if(c.ownedScaleOutReviewTriggered===true&&Number.isSafeInteger(o)&&o>0)return paperAutoExecutionScaleRunner.runOnce({action:'scale_out',targetQuantity:o});
 const i=Number(c.ownedScaleInTargetQuantity);if(c.ownedScaleInReviewTriggered===true&&Number.isSafeInteger(i)&&i>0)return paperAutoExecutionScaleRunner.runOnce({action:'scale_in',targetQuantity:i});
 return paperAutoExecutionScaleRunner.diagnostics();
}catch(e){console.error('[paper-auto-execution-scale] cycle failed closed',{source,error:e?.message??String(e)});return paperAutoExecutionScaleRunner.diagnostics()}};

const paperAutoExitMonitorWorker = createPaperAutoExitMonitorWorker({
  accountCredentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials,
  getConfiguredLifecycleFile: () => activePaperAutoExecutionLifecycleFile,
  fetchOwnedMonitor: getPaperAutoExecutionOwnedMonitor,
  onTerminalLifecycle: () => runPaperAutoExecutionContinuityCycle('terminal_exit'),
  degradedBrokerMode: paperAutoExecutionDegradedBrokerMode,
});

const paperAutoExecutionExitRecoveryRunner = createPaperAutoExecutionExitRecoveryRunner({
  getLifecycleFile: () => activePaperAutoExecutionLifecycleFile,
  accountCredentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials,
  degradedBrokerMode: paperAutoExecutionDegradedBrokerMode,
});

const paperAutoExecutionExitReplacementSubmit = async (order, context) => {
  const resolved = await resolveInternalOwnerAlpacaReadonlyCredentials({ masterKey: process.env.GEMINI_CREDENTIAL_MASTER_KEY });
  if (resolved?.readyForReadonlyBrokerRead !== true) throw Error('paper_exit_replacement_runtime_credentials_required');
  return createPaperAutoExecutionAlpacaPaperAdapter({
    env: { ...process.env, ...resolved.env, PAPER_AUTO_ALPACA_ADAPTER_ENABLED:'1', PAPER_AUTO_ALPACA_PAPER_BASE_URL:'https://paper-api.alpaca.markets' },
  }).submitPaperOrder(order, context);
};

const paperAutoExecutionExitReplacementRunner = createPaperAutoExecutionExitReplacementRunner({
  getLifecycleFile: () => activePaperAutoExecutionLifecycleFile,
  fetchAccount: () => fetchAlpacaPaperAccountReadonly({ credentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials }),
  fetchMarketClock: () => fetchAlpacaMarketClockReadonly({ credentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials }),
  fetchOrderByClientOrderId: ({ clientOrderId }) => fetchAlpacaPaperExitReplacementOrderByClientOrderIdReadonly({ clientOrderId, credentialResolver: resolveInternalOwnerAlpacaReadonlyCredentials }),
  submitPaperOrder: paperAutoExecutionExitReplacementSubmit,
  degradedBrokerMode: paperAutoExecutionDegradedBrokerMode,
});

const PAPER_AUTO_EXECUTION_CONTINUITY_INTERVAL_MS = 15000;
let paperAutoExecutionContinuityCycleInFlight = null;
const runPaperAutoExecutionContinuityCycle = (source = 'runtime') => {
  if (paperAutoExecutionContinuityCycleInFlight) return paperAutoExecutionContinuityCycleInFlight;
  paperAutoExecutionContinuityCycleInFlight = (async () => {
    try {
      await runPaperAutoExecutionDegradedBrokerRecoveryProbe();
    } catch (error) {
      console.error('[paper-auto-execution-degraded-broker] recovery probe failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
    try {
      await paperAutoExecutionExitRecoveryRunner.runOnce();
    } catch (error) {
      console.error('[paper-auto-execution-exit-recovery] runner cycle failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
    try {
      await paperAutoExecutionExitReplacementRunner.runOnce();
    } catch (error) {
      console.error('[paper-auto-execution-exit-replacement] runner cycle failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
    try {
      await paperAutoExecutionContinuityRuntime.runOnce();
    } catch (error) {
      console.error('[paper-auto-execution-continuity] runtime cycle failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
    try {
      await paperAutoExecutionContinuityEnterRunner.runOnce();
    } catch (error) {
      console.error('[paper-auto-execution-continuity-enter] runner cycle failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
    try {
      const cache = await underFiveSharedCachePromise;
      const latest = cache?.getLatest?.() ?? null;
      const marketOpen = latest?.marketClock?.isOpen === true;
      await runPaperAutoExecutionExecutionAssurance({ marketOpen });
    } catch (error) {
      console.error('[paper-auto-execution-execution-assurance] evaluation failed closed', {
        source,
        error: error?.message ?? String(error),
      });
      try {
        const incidentMod = await import('./scanner/admin_paper_operational_incident_emitter.mjs');
        paperAutoExecutionExecutionAssuranceLastIncident = await incidentMod.emitAdminPaperOperationalIncident({
          source: 'paper_execution',
          category: 'paper_execution_assurance',
          severity: 'critical',
          failureCode: 'EXECUTION_ASSURANCE_EVALUATION_ERROR',
          summary: 'Automatic PAPER execution assurance evaluator failed.',
          phase: 'execution_assurance',
          route: '/diagnostics/paper-auto-execution-execution-assurance',
          process: 'gemini-scanner',
        }, {
          ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
        });
      } catch {}
    }
    try {
      await runPaperAutoExecutionScaleCycle(source);
    } catch (error) {
      console.error('[paper-auto-execution-scale] runner cycle failed closed', {
        source,
        error: error?.message ?? String(error),
      });
    }
  })().finally(() => {
    paperAutoExecutionContinuityCycleInFlight = null;
  });
  return paperAutoExecutionContinuityCycleInFlight;
};

const customerReportBackgroundAiReviewWorker = createCustomerReportBackgroundAiReviewWorker({
  runReview: ({ now } = {}) => runCustomerReportBackgroundAiReview({
    now,
    fetchBrokerPerformanceEvidence: ({ now: reviewNow } = {}) => fetchCustomerBrokerPerformanceEvidence({ now: reviewNow }),
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
  const paperAutoExitStatus = paperAutoExitMonitorWorker.start();
  console.log('[paper-auto-exit-monitor] worker status', {
    enabled: paperAutoExitStatus.enabled,
    running: paperAutoExitStatus.running,
    intervalMs: paperAutoExitStatus.intervalMs,
    lastStatus: paperAutoExitStatus.lastStatus,
  });
  void runPaperAutoExecutionContinuityCycle('startup');
  const paperAutoExecutionContinuityTimer = setInterval(
    () => void runPaperAutoExecutionContinuityCycle('authoritative_fallback'),
    PAPER_AUTO_EXECUTION_CONTINUITY_INTERVAL_MS,
  );
  paperAutoExecutionContinuityTimer.unref?.();
  try {
    const paperAutoExitMonitoringSymbol = paperAutoExitMonitorWorker.configuredMonitoringSymbol();
    let marketDataStream = null;
    marketDataStream = await startMarketDataStream({
      runtime: { additionalSymbols: paperAutoExitMonitoringSymbol ? [paperAutoExitMonitoringSymbol] : [] },
      onMarketDataEvent: (event) => {
        paperAutoExitMonitorWorker.onMarketDataEvent(event);
        const activePaperExitSymbol = paperAutoExitMonitorWorker.configuredMonitoringSymbol();
        if (activePaperExitSymbol) marketDataStream?.addSymbols?.([activePaperExitSymbol]);
      },
    });
    const activePaperExitSymbol = paperAutoExitMonitorWorker.configuredMonitoringSymbol();
    if (activePaperExitSymbol) marketDataStream.addSymbols?.([activePaperExitSymbol]);
    console.log('[server] market data stream started');
  } catch (e) {
    console.error('[server] market data stream failed to start:', e);
  }
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
    const mod = await import('./scanner/paper_broker_runtime_environment_preflight_app_screen.mjs');
    const payload = mod.buildPaperBrokerRuntimeEnvironmentPreflightAppScreen({ loadSourceReport: false });
    res.json({ ...payload, route: '/diagnostics/paper-broker-runtime-environment-preflight' });
  } catch (err) {
    res.status(500).json({ ok: false, route: '/diagnostics/paper-broker-runtime-environment-preflight', error: err?.message ?? String(err) });
  }
});





app.get('/app/paper-trading-readiness-gate', (_req, res) => res.redirect(302, '/app/paper-readiness-gate'));










app.get('/diagnostics/paper-trade-position-state-auto-refresh', (_req, res) => {
  res.json(paperPositionStateAutoRefresh.diagnostics());
});

app.get('/diagnostics/paper-auto-exit-monitor', (_req, res) => {
  res.json(paperAutoExitMonitorWorker.diagnostics());
});

app.get('/diagnostics/paper-auto-execution-continuity', (_req, res) => {
  res.json(paperAutoExecutionContinuityRuntime.diagnostics());
});

app.get('/diagnostics/paper-auto-execution-continuity-enter', (_req, res) => {
  res.json(paperAutoExecutionContinuityEnterRunner.diagnostics());
});


app.get('/diagnostics/paper-auto-execution-execution-assurance', (_req, res) => {
  res.json({
    report: paperAutoExecutionExecutionAssuranceLastReport,
    incident: paperAutoExecutionExecutionAssuranceLastIncident,
    ledgerPath: PAPER_AUTO_EXECUTION_ASSURANCE_LEDGER_PATH,
    readOnly: true,
    remediationAllowed: false,
  });
});


app.get('/diagnostics/paper-auto-execution-scale', (_req, res) => {
  res.json(paperAutoExecutionScaleRunner.diagnostics());
});

app.get('/diagnostics/paper-auto-execution-degraded-broker-mode', (_req, res) => {
  res.json(paperAutoExecutionDegradedBrokerMode.diagnostics());
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
  const now = new Date();
  const brokerPerformance = await buildCustomerBrokerPerformanceReport({
    accountId: req.customerAccount?.id,
    evidence: req.customerBrokerPerformanceEvidence,
    fetchedPaperAccount: req.customerPaperAccountFetch,
    period: req.query.period ?? 'lifetime',
    defaultPeriod: 'lifetime',
    now,
  });
  const performanceReport = brokerPerformance.performanceReport;
  const premarketCache = await premarketSharedCachePromise;
  const premarketAutoStatus = premarketCache?.getDiagnostics?.() ?? null;
  const postMarketAutoStatus = postMarketRuntimeWorker.getStatus();
  const hub = mod.buildCustomerScannerHub({
    route: "/customer",
    performanceReport,
    premarketAutoStatus,
    postMarketAutoStatus,
  });
  res.set('Cache-Control', 'no-store');
  res.type('html').send(mod.renderCustomerScannerHubHtml(hub, req.customerAccount));
});


app.get('/customer/portfolio', requireCustomerSession, async (req, res) => {
  try {
    const portfolioModelMod = await import('./scanner/customer_portfolio_model.mjs');
    const portfolioPageMod = await import('./scanner/customer_portfolio_page.mjs');
    const accountData = await import('./scanner/alpaca_paper_account_readonly_fetch.mjs');
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const ownedAssetStore = await import('./scanner/customer_owned_asset_store.mjs');
    const windDownPolicy = await import('./scanner/customer_portfolio_wind_down_policy.mjs');

    const rawFetchedPaperAccount = req.customerPaperAccountFetch ?? await accountData.fetchAlpacaPaperAccountReadonly();
    const now = new Date();
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
    const lifetimePerformance = (await buildCustomerBrokerPerformanceReport({
      accountId: req.customerAccount?.id,
      evidence: req.customerBrokerPerformanceEvidence,
      fetchedPaperAccount,
      paperAccount: brokerPaperAccount,
      period: 'lifetime',
      defaultPeriod: 'lifetime',
      now,
    })).performanceReport;
    const automaticPaper = {
      continuity: paperAutoExecutionContinuityRuntime.diagnostics(),
      enter: paperAutoExecutionContinuityEnterRunner.diagnostics(),
      scale: paperAutoExecutionScaleRunner.diagnostics(),
      exit: paperAutoExitMonitorWorker.diagnostics(),
    degradedBroker: paperAutoExecutionDegradedBrokerMode.diagnostics(),
      lifecycle: paperAutoExecutionContinuityRuntime.diagnostics()?.lastLifecycle ?? null,
      safety: { paperOnly: true, liveTradingAllowed: false },
    };
    const page = portfolioPageMod.buildCustomerPortfolioPage({
      model,
      account: req.customerAccount,
      lifetimePerformance,
      ownedAssets,
      connectedPositions: brokerPaperAccount.positions,
      brokerConnected: brokerPaperAccount.connected === true,
      windDown,
      automaticPaper,
      saved: req.query?.saved === "1",
      windDownUpdated: req.query?.windDown === "1",
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



app.post('/customer/portfolio/manual-exit', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const symbol = String(req.body?.symbol ?? '').trim().toUpperCase();
  const quantity = Number(req.body?.quantity);
  const paperOnly = String(req.body?.paperOnly ?? '').toLowerCase() === 'true';
  try {
    if (!paperOnly) throw new Error('customer_manual_exit_paper_only_required');
    if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) throw new Error('customer_manual_exit_exact_symbol_required');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('customer_manual_exit_exact_positive_quantity_required');
    const fsMod = await import('node:fs');
    const pathMod = await import('node:path');
    const runsDir = pathMod.resolve(process.cwd(), 'runs');
    const matches = [];
    for (const name of fsMod.readdirSync(runsDir)) {
      if (!name.endsWith('.json')) continue;
      const file = pathMod.join(runsDir, name);
      let lifecycle;
      try { lifecycle = JSON.parse(fsMod.readFileSync(file, 'utf8')); } catch { continue; }
      if (lifecycle?.state === 'MONITORING'
        && String(lifecycle?.selectedSymbol ?? '').trim().toUpperCase() === symbol
        && Number(lifecycle?.filledQuantity) === quantity
        && String(lifecycle?.brokerPositionIdentity ?? '').trim() === `${symbol}:${quantity}`
        && lifecycle?.lifecycleId) matches.push({ file, lifecycle });
    }
    if (matches.length !== 1) {
      const code = matches.length === 0 ? 'customer_manual_exit_monitoring_lifecycle_not_found' : 'customer_manual_exit_monitoring_lifecycle_ambiguous';
      return res.status(409).type('html').send(renderThemedStatusPage({ surface:'customer', title:'PAPER EXIT blocked', message:`${code}. GeminiScanner requires exactly one MONITORING PAPER lifecycle matching the broker-confirmed symbol and quantity before manual EXIT can run.`, href:'/customer/portfolio' }));
    }
    const target = matches[0];
    const runnerMod = await import('./scanner/paper_auto_execution_exit_only_runner.mjs');
    const result = await runnerMod.runPaperAutoExecutionExitOnly({
      args: { execute:'true', lifecycleFile:target.file, lifecycleId:target.lifecycle.lifecycleId, symbol, quantity:String(quantity) },
      env: process.env, fetchImpl: globalThis.fetch, nowMs: Date.now(),
    });
    if (result?.status === 'EXACT_POSITION_PAPER_EXIT_COMPLETED') {
      return res.status(200).type('html').send(renderThemedStatusPage({ surface:'customer', title:'PAPER EXIT completed', message:`${symbol} quantity ${quantity} exited through GeminiScanner exact-position PAPER execution and reconciliation.`, href:'/customer/portfolio' }));
    }
    const detail = String(result?.status ?? result?.blockers?.join(', ') ?? 'unknown_result');
    return res.status(409).type('html').send(renderThemedStatusPage({ surface:'customer', title:'PAPER EXIT not completed', message:`${detail}. GeminiScanner remained fail-closed unless the exact-position PAPER EXIT and reconciliation completed.`, href:'/customer/portfolio' }));
  } catch (error) {
    console.error('[customer-portfolio-manual-exit]', error);
    return res.status(409).type('html').send(renderThemedStatusPage({ surface:'customer', title:'PAPER EXIT blocked', message:`GeminiScanner failed closed: ${String(error?.message ?? error ?? 'manual_exit_failed')}`, href:'/customer/portfolio' }));
  }
});


app.post('/customer/paper-order/prepare', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  try {
    const mod = await import('./scanner/customer_paper_user_initiated_order_preparation.mjs');
    const record = mod.buildCustomerPaperOrderPreparation({
      mode: req.body?.mode,
      symbol: req.body?.symbol,
      quantity: req.body?.quantity,
      paperOnly: String(req.body?.paperOnly ?? '').toLowerCase() === 'true',
    });
    if (!record.ok) {
      return res.status(400).type('html').send(`<!doctype html><html><body><main><h1>Paper order preparation blocked</h1><p>${record.blockers.join(', ')}</p><p>No broker contact or order placement occurred.</p><p><a href="/customer/scanner/under-five">Back to scanner</a> · <a href="/customer/portfolio">Back to portfolio</a></p></main></body></html>`);
    }
    const saved = mod.persistCustomerPaperOrderPreparation(record, { accountId: req.customerAccount?.id });
    const bridgeMod = await import('./scanner/customer_paper_preparation_lifecycle_bridge.mjs');
    const handoff = bridgeMod.bridgePaperPreparationToLifecycle(saved, {
      accountId: req.customerAccount?.id,
    });
    const localMockControl = process.env.CUSTOMER_PAPER_LOCAL_MOCK_EXERCISE_ENABLED === '1'
      ? `<form method="post" action="/customer/paper-order/mock-exercise"><input type="hidden" name="preparationId" value="${saved.preparationId}"><button type="submit">Run LOCAL MOCK PAPER ${saved.mode}</button></form><p>LOCAL MOCK only: deterministic synthetic reconciliation; no Alpaca order or position will be created.</p>`
      : '';
    return res.status(200).type('html').send(`<!doctype html><html><body><main><h1>PAPER ${saved.mode} lifecycle ready</h1><p><strong>${saved.symbol}</strong> · quantity ${saved.quantity}</p><p>Preparation ID: ${saved.preparationId}</p><p>Lifecycle ID: ${handoff.lifecycleId}</p><p>Client order ID: ${handoff.order.clientOrderId}</p><p>Status: ${handoff.status}</p><p>GeminiScanner created or resolved the exact PAPER lifecycle and deterministic order handoff at the retained submission boundary. This request did not contact Alpaca, submit an order, or mutate the account.</p>${localMockControl}<p><a href="/customer/scanner/under-five">Back to scanner</a> · <a href="/customer/portfolio">Back to portfolio</a></p></main></body></html>`);
  } catch (error) {
    console.error('[customer-paper-order-prepare]', error);
    try {
      const incidentMod = await import('./scanner/admin_paper_operational_incident_emitter.mjs');
      await incidentMod.emitAdminPaperOperationalIncident({
        source: 'paper_reconciliation',
        severity: 'critical',
        failureCode: String(error?.message ?? 'customer_paper_order_prepare_failed'),
        summary: 'Customer PAPER order preparation failed before broker submission.',
        route: '/customer/paper-order/prepare',
        process: 'server',
      });
    } catch {}
    const conflictErrors = new Set([
      'paper_enter_customer_preparation_in_progress',
      'paper_enter_active_customer_lifecycle_exists',
      'paper_exit_matching_lifecycle_not_found',
      'paper_exit_multiple_matching_lifecycles',
      'paper_preparation_account_required',
      'paper_preparation_account_mismatch',
      'customer_account_required',
    ]);
    if (conflictErrors.has(String(error?.message ?? ''))) {
      return res.status(409).type('html').send('<!doctype html><html><body><main><h1>Paper order preparation blocked</h1><p>The requested PAPER lifecycle could not be prepared because the authenticated customer state is busy, missing, or does not match this request. Refresh the scanner or portfolio and try again after the current PAPER lifecycle state is resolved.</p><p>No broker contact or order placement occurred.</p><p><a href="/customer/scanner/under-five">Back to scanner</a> · <a href="/customer/portfolio">Back to portfolio</a></p></main></body></html>');
    }
    return res.status(500).type('html').send('<!doctype html><html><body><main><h1>Paper order preparation failed</h1><p>No broker contact or order placement occurred.</p></main></body></html>');
  }
});


app.post('/customer/paper-order/mock-exercise', requireCustomerSession, requireCustomerSameOrigin, async (req, res) => {
  if (process.env.CUSTOMER_PAPER_LOCAL_MOCK_EXERCISE_ENABLED !== '1') {
    return res.status(403).type('html').send('<!doctype html><html><body><main><h1>LOCAL MOCK PAPER exercise blocked</h1><p>The dedicated local-mock gate is disabled. No broker contact or order placement occurred.</p></main></body></html>');
  }
  try {
    const mod = await import('./scanner/customer_paper_local_mock_exercise.mjs');
    const result = await mod.exerciseCustomerPaperLocalMock({
      accountId: req.customerAccount?.id,
      preparationId: req.body?.preparationId,
    });
    return res.status(200).type('html').send(`<!doctype html><html><body><main><h1>LOCAL MOCK PAPER lifecycle completed</h1><p>Preparation ID: ${result.preparationId}</p><p>Lifecycle ID: ${result.lifecycle.lifecycleId}</p><p>Final lifecycle state: ${result.lifecycle.state}</p><p>Status: ${result.status}</p><p>Deterministic synthetic reconciliation only. No broker contact, Alpaca order placement, Alpaca position creation, or brokerage account mutation occurred.</p><p><a href="/customer/scanner/under-five">Back to scanner</a> · <a href="/customer/portfolio">Back to portfolio</a></p></main></body></html>`);
  } catch (error) {
    console.error('[customer-paper-order-mock-exercise]', error);
    return res.status(409).type('html').send('<!doctype html><html><body><main><h1>LOCAL MOCK PAPER exercise blocked</h1><p>The preparation or authenticated customer lifecycle did not match the required local-mock contract. No broker contact or order placement occurred.</p></main></body></html>');
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
    const timeMod = await import('./scanner/customer_time.mjs');
    const realtimeAiMod = await import('./scanner/customer_report_realtime_ai_client.mjs');
    const qualityProposalMod = await import('./scanner/decision_quality_proposal_generation.mjs');
    const calibrationReviewMod = await import('./scanner/proposal_evidence_aggregation_calibration_review.mjs');
    const calibrationHistoryMod = await import('./scanner/proposal_calibration_history_store.mjs');

    const now = new Date();
    const performanceEpoch = getCustomerPerformanceEpoch(req.customerAccount?.id);
    if (performanceEpoch?.ok !== true) throw new Error(`customer_performance_epoch_unavailable:${performanceEpoch?.reason ?? 'unknown'}`);
    const performanceEpochStartedAt = performanceEpoch.active === true
      ? performanceEpoch.epoch?.startedAt ?? null
      : null;
    const brokerEvidence = req.customerBrokerPerformanceEvidence ?? await fetchCustomerBrokerPerformanceEvidence({
      fetchedPaperAccount: req.customerPaperAccountFetch,
      now,
    });
    const fetchedPaperAccount = brokerEvidence.fetchedPaperAccount;
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(fetchedPaperAccount);
    const fillLedgerHistory = brokerEvidence.fillLedgerHistory;
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
      performanceEpochStartedAt,
      paperAccount,
      fillLedgerHistory,
      fillLedgerHistorySource: brokerEvidence.fillLedgerHistorySource,
      fillLedgerHistoryCompleteness: brokerEvidence.fillLedgerHistoryCompleteness,
      brokerObservationTs: brokerEvidence.brokerObservationTs,
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
    const realtimeAiConfig = realtimeAiMod.getCustomerReportRealtimeAiConfig(process.env);
    const realtimeAiReview = Object.freeze({
      version: realtimeAiMod.VERSION,
      status: realtimeAiConfig.enabled ? 'deferred_nonblocking' : 'disabled',
      provider: 'openai',
      model: realtimeAiConfig.model,
      reviewText: null,
      readOnly: true,
      paperOnly: true,
      requiresBacktest: true,
      requiresOperatorApproval: false,
      automaticLogicMutationAllowed: false,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
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
      renderThemedStatusPage({ surface: 'customer', title: 'Reports unavailable', message: 'Paper analytics could not be loaded. No order placement or account mutation was performed.', href: '/customer' }),
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
  const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
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
  const now = new Date();
  const brokerEvidence = req.customerBrokerPerformanceEvidence ?? await fetchCustomerBrokerPerformanceEvidence({
    fetchedPaperAccount: req.customerPaperAccountFetch,
    now,
  });
  const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(brokerEvidence.fetchedPaperAccount);
  const performanceReport = (await buildCustomerBrokerPerformanceReport({
    accountId: req.customerAccount?.id,
    evidence: brokerEvidence,
    paperAccount,
    period: 'lifetime',
    defaultPeriod: 'lifetime',
    now,
  })).performanceReport;
  const resultFilters = states.length ? { states } : getCustomerZeroResultFilters(req.customerAccount?.id).filters;
  const dashboard = viewMod.buildCustomerUnderFiveDashboard(source, {
    route: '/customer/scanner/run',
    resultFilters,
    maxPrice,
    noPriceCeiling: watchlistOnly,
    paperAccount,
    performanceReport,
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
    const groupToggle = document.querySelector('[data-show-passwords]');
    if (groupToggle instanceof HTMLInputElement && groupToggle.type === 'checkbox') {
      const groupFields = Array.from(document.querySelectorAll(
        'input[name="currentPassword"], input[name="newPassword"], input[name="confirmPassword"]'
      ));
      groupToggle.addEventListener('change', () => {
        const nextType = groupToggle.checked ? 'text' : 'password';
        for (const field of groupFields) {
          if (field instanceof HTMLInputElement) field.type = nextType;
        }
      });
    }
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
    const icon = heading.querySelector('.gs-icon');
    const buildLabel = () => {
      const label = document.createElement('span');
      label.className = 'settings-icon-label';
      if (icon) label.append(icon.cloneNode(true));
      const text = document.createElement('span');
      text.textContent = title;
      label.append(text);
      return label;
    };
    const summary = document.createElement('summary');
    summary.append(buildLabel());
    section.before(details);
    details.append(summary, section);
    const shortcut = document.createElement('button');
    shortcut.type = 'button';
    shortcut.append(buildLabel());
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
.settings-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 22px;padding:12px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.5)}
.settings-toolbar button{padding:8px 11px;background:rgba(24,215,255,.08);display:inline-flex;align-items:center;gap:8px}
.settings-icon-label{display:inline-flex;align-items:center;gap:9px;min-width:0}
.settings-toolbar .gs-icon,.settings-group>summary .gs-icon{color:var(--gs-accent);filter:drop-shadow(0 0 5px rgba(24,215,255,.24))}
.danger-settings .settings-icon-label .gs-icon{color:#ff7a86}
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
.about-ai-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.about-ai-grid article{padding:14px 15px;border:1px solid var(--gs-line);border-radius:14px;background:rgba(0,0,0,.34)}.about-ai-grid h3{margin:0 0 7px}.about-ai-grid p{margin:0;color:var(--gs-muted);line-height:1.5}
@media (max-width:600px){.row{grid-template-columns:1fr;gap:4px}.settings-toolbar{position:sticky;top:8px;z-index:8}.settings-group>summary{padding:14px}.about-ai-grid{grid-template-columns:1fr}}
</style>
</head>
<body data-gs-page="customer-settings" data-gs-theme="${esc(account?.displayPreferences?.theme || 'system')}" data-gs-density="${esc(account?.displayPreferences?.density || 'comfortable')}" data-gs-reduced-motion="${account?.displayPreferences?.reducedMotion ? 'true' : 'false'}">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: 'customer', homeHref: '/customer', label: 'GeminiScanner' })}
<main class="wrap" data-role="customer" data-page="settings">
${renderCustomerPrimaryNavigation({ active: 'settings' })}
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
<h2><span class="gs-icon-heading">${renderCustomerIcon('activity', { size: 22 })}<span>Security activity</span></span></h2>
<h3>Recent sign-ins</h3>
${latestLogin
  ? `<div class="details"><div class="row"><div class="label">${esc(formatCustomerDateTime(latestLogin.loginAt, account, { fallback: 'Unknown time' }))}</div><div class="value">${esc(latestLogin.ip || 'unknown')} | ${esc(latestLogin.userAgent || 'unknown')}</div></div></div>${earlierLogins.length ? `<details class="signin-history"><summary>Show ${earlierLogins.length} earlier sign-in${earlierLogins.length === 1 ? '' : 's'}</summary><div class="details">${earlierLogins.map((entry) => `<div class="row"><div class="label">${esc(formatCustomerDateTime(entry?.loginAt, account, { fallback: 'Unknown time' }))}</div><div class="value">${esc(entry?.ip || 'unknown')} | ${esc(entry?.userAgent || 'unknown')}</div></div>`).join('')}</div></details>` : ''}`
  : '<p style="color:#9eb0c9">No recent sign-in activity is available yet.</p>'}
<p style="color:#9eb0c9">Review password, email, authenticator, session, and account security changes on the complete read-only activity page.</p>
<p><a href="/customer/security-activity">View complete security activity</a></p>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('security', { size: 22 })}<span>Security</span></span></h2>
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
<input id="newPassword" name="newPassword" type="password" minlength="8" autocomplete="new-password" required></p>
<p><label for="confirmPassword">Confirm new password</label><br>
<input id="confirmPassword" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" required></p>
<p><button type="submit" style="background:#3d72d9">Change password</button></p>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('bell', { size: 22 })}<span>EXIT notifications</span></span></h2>
<form method="post" action="/customer/settings/notifications" data-exit-notification-settings>
<p style="color:#9fb6bf">Notify me only when GeminiScanner has a valid EXIT state for a specifically identified paper position. Stale data, identity ambiguity, missing position data, or failed reconciliation remain separate blocked or error states.</p>
<fieldset style="margin:16px 0;padding:14px;border:0;border-radius:12px;background:rgba(2,9,12,.42)">
<legend><b>${renderCustomerIcon('exit', { size: 18 })} EXIT alert channels</b></legend>
<p><label><input name="exitWebsiteEnabled" type="checkbox"${account?.notificationPreferences?.exitWebsiteEnabled ? ' checked' : ''}> Website EXIT notification</label></p>
<p><label><input name="exitSoundEnabled" type="checkbox"${account?.notificationPreferences?.exitSoundEnabled ? ' checked' : ''}> Sound and vibration for EXIT</label></p>
<p><label><input name="exitEmailEnabled" type="checkbox"${account?.notificationPreferences?.exitEmailEnabled ? ' checked' : ''}> Email EXIT notification</label></p>
<p><label for="exitNotificationEmail">${renderCustomerIcon('mail', { size: 18 })} Destination email</label><br>
<input id="exitNotificationEmail" name="exitNotificationEmail" type="email" autocomplete="email" value="${esc(account?.notificationPreferences?.exitNotificationEmail || account?.email || '')}" placeholder="you@example.com"></p>
<p style="color:#9fb6bf">A valid alert identifies the symbol, exact owned quantity, current price when available, EXIT reason, timestamp, and freshness or reconciliation status. This notification setting does not submit an order. Automatic Alpaca PAPER EXIT runs independently under its dedicated fail-closed lifecycle, freshness, identity, reconciliation, and submission safeguards; live trading remains disabled.</p>
<p><button type="button" data-test-exit-notification>${renderCustomerIcon('test', { size: 18 })} Test EXIT notification</button></p>
<p data-exit-notification-test-status style="color:#9fb6bf">Test not run on this device.</p>
</fieldset>
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
<h2><span class="gs-icon-heading">${renderCustomerIcon('appearance', { size: 22 })}<span>Appearance</span></span></h2>
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
<section id="about-ai" style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('ai', { size: 22 })}<span>About GeminiScanner AI</span></span></h2>
<p style="color:#9eb0c9">GeminiScanner uses AI in the background to review scanner results, paper-trading reports, and historical evidence. It helps turn complex information into clearer observations and highlights patterns that may deserve attention.</p>
<div class="about-ai-grid">
<article><h3>What AI does</h3><p>Reviews available information, summarizes patterns, highlights potential risks, and helps identify areas that may deserve a closer look.</p></article>
<article><h3>What AI does not do by itself</h3><p>AI does not independently place trades, change your brokerage account, or change GeminiScanner strategy rules or safety limits.</p></article>
<article><h3>How changes are handled</h3><p>Any suggested strategy change must be tested before it can be used.</p></article>
<article><h3>Why technical details stay in the background</h3><p>Diagnostic and audit information is retained for reliability, testing, and support while everyday screens focus on useful customer information.</p></article>
</div>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('data', { size: 22 })}<span>Your data</span></span></h2>
<p style="color:#9eb0c9">Download a readable copy of the information stored with your GeminiScanner customer account. Passwords and authenticator secrets are excluded.</p>
<form method="post" action="/customer/settings/data/export">
<button type="submit" style="background:#3d72d9">Download readable copy of my data</button>
</form>
<details class="signin-history"><summary>Technical export</summary>
<p style="color:#9eb0c9">For data portability or technical support, you can also download the same protected account export as JSON.</p>
<form method="post" action="/customer/settings/data/export?format=json">
<button type="submit">Download technical JSON</button>
</form>
</details>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('sessions', { size: 22 })}<span>Sessions</span></span></h2>
<p style="color:#9eb0c9">Sign out this account on every device, including this one.</p>
<form method="post" action="/customer/settings/sessions/revoke">
<button type="submit">Sign out all sessions</button>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('deactivate', { size: 22 })}<span>Deactivate account</span></span></h2>
<p style="color:#9eb0c9">Deactivate this customer account and sign out every session.</p>
<form method="post" action="/customer/settings/account/deactivate">
<p><label for="deactivateAccountPassword">Current password</label><br>
<input id="deactivateAccountPassword" name="currentPassword" type="password" autocomplete="current-password" required></p>
<p><label><input name="confirmDeactivate" type="checkbox" required> I understand this will deactivate my account.</label></p>
<button type="submit">Deactivate account</button>
</form>
</section>
<section style="margin-top:28px;padding-top:20px;border-top:1px solid #263a58">
<h2><span class="gs-icon-heading">${renderCustomerIcon('delete', { size: 22 })}<span>Permanently delete account</span></span></h2>
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
<script src="/assets/customer-exit-notification-settings.js" defer></script>
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

  if (String(req.query?.format ?? '').toLowerCase() === 'json') {
    res.set('Content-Disposition', `attachment; filename="geminiscanner-customer-data-${safeId}.json"`);
    return res.status(200).type('application/json').send(`${JSON.stringify(result.export, null, 2)}\n`);
  }

  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const yesNo = (value) => value === true ? 'Yes' : value === false ? 'No' : 'Not available';
  const text = (value, fallback = 'Not available') => {
    const cleaned = String(value ?? '').trim();
    return cleaned || fallback;
  };
  const themeLabel = (value) => ({
    dark: 'Dark',
    light: 'Light',
    system: 'Use device setting',
  }[String(value ?? '').trim().toLowerCase()] ?? text(value, 'Use device setting'));
  const localeLabel = (value) => ({
    'en-US': 'English (United States)',
    'en-CA': 'English (Canada)',
    'en-GB': 'English (United Kingdom)',
  }[String(value ?? '').trim()] ?? text(value, 'English (United States)'));
  const timeZoneLabel = (value) => ({
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Los_Angeles': 'Pacific Time',
  }[String(value ?? '').trim()] ?? text(value, 'Eastern Time'));
  const densityLabel = (value) => ({
    compact: 'Compact',
    comfortable: 'Comfortable',
  }[String(value ?? '').trim().toLowerCase()] ?? text(value, 'Comfortable'));
  const scannerTokenLabel = (value) => ({
    ENTER: 'Enter',
    EXIT: 'Exit',
    WAIT: 'Wait',
    WATCH: 'Watch',
    BLOCKED: 'Blocked',
    DO_NOT_ENTER: 'Do not enter',
    STALE_DATA: 'Stale data',
    NO_SETUP: 'No setup',
    intraday: 'Intraday',
    watchlist: 'Watchlist',
    stocks: 'Stocks',
  }[String(value ?? '').trim()] ?? String(value ?? '').trim()
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase()));
  const scannerListLabel = (values, fallback) => Array.isArray(values) && values.length
    ? values.map(scannerTokenLabel).filter(Boolean).join(', ')
    : fallback;
  const customerDateTime = (value) => value
    ? formatCustomerDateTime(value, req.customerAccount, { fallback: text(value) })
    : 'Not available';
  const customerDate = (value) => value
    ? formatCustomerDate(value, req.customerAccount, { fallback: text(value) })
    : 'Not available';
  const row = (label, value) => `<div class="data-row"><div class="data-label">${escapeHtml(label)}</div><div class="data-value">${escapeHtml(value)}</div></div>`;
  const section = (title, intro, rows) => `<section class="report-section"><h2>${escapeHtml(title)}</h2>${intro ? `<p class="muted">${escapeHtml(intro)}</p>` : ''}${rows.join('')}</section>`;

  const accountData = result.export?.account ?? {};
  const display = accountData.displayPreferences ?? {};
  const notifications = accountData.notificationPreferences ?? {};
  const scannerSelections = accountData.scannerSelections ?? {};
  const customerZeroFilters = accountData.customerZeroResultFilters ?? {};

  const fullName = [accountData.firstName, accountData.lastName]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(' ') || 'Not available';
  const enabledNotifications = [
    notifications.scannerAlerts ? 'Scanner alerts' : null,
    notifications.exitWebsiteEnabled ? 'Website EXIT alerts' : null,
    notifications.exitSoundEnabled ? 'Sound/vibration EXIT alerts' : null,
    notifications.exitEmailEnabled ? 'Email EXIT alerts' : null,
    notifications.reportEmailEnabled ? 'Email reports' : null,
    notifications.reportSmsEnabled ? 'Text report notices' : null,
  ].filter(Boolean);
  const notificationSummary = enabledNotifications.length
    ? enabledNotifications.join(', ')
    : 'No optional notifications enabled';
  const scannerModes = scannerListLabel(scannerSelections.modes, 'Default');
  const scannerAssets = scannerListLabel(scannerSelections.assets, 'Default');
  const priceRanges = scannerListLabel(scannerSelections.priceRanges, 'Default');
  const resultStates = scannerListLabel(scannerSelections.states, 'Default');
  const zeroStates = scannerListLabel(customerZeroFilters.states, 'Show all');

  const reportSections = [
    section('Account information', '', [
      row('Name', fullName),
      row('Email', text(accountData.email)),
      row('Account status', text(accountData.status, 'Unknown')),
      row('Email verified', yesNo(accountData.emailVerified)),
      row('Member since', customerDate(accountData.createdAt)),
    ]),
    section('Preferences', '', [
      row('Theme', themeLabel(display.theme)),
      row('Language and number format', localeLabel(display.locale)),
      row('Time zone', timeZoneLabel(display.timezone)),
      row('Layout', densityLabel(display.density)),
      row('Reduce motion', yesNo(display.reducedMotion)),
      row('Notifications', notificationSummary),
    ]),
    section('Security summary', 'Only basic security information is shown here. Device details, IP addresses, internal identifiers, and technical security records are intentionally omitted.', [
      row('Authenticator enabled', yesNo(accountData.authenticatorEnabled)),
      row('Last sign-in', customerDateTime(accountData.lastLoginAt)),
    ]),
    section('Scanner preferences', '', [
      row('Scanner modes', scannerModes),
      row('Asset types', scannerAssets),
      row('Price ranges', priceRanges),
      row('Result states', resultStates),
      row('Customer Zero filters', zeroStates),
    ]),
  ].join('');

  const generatedAt = customerDateTime(result.export?.generatedAt);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner — My account data</title>
<style>
:root{color-scheme:dark}html{-webkit-text-size-adjust:100%;text-size-adjust:100%}*{box-sizing:border-box}body{margin:0;background:#061014;color:#eefcff;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.5;overflow-wrap:anywhere}.wrap{max-width:820px;margin:auto;padding:28px 16px 56px}.hero,.report-section{border:1px solid #25424a;border-radius:14px;background:#09171c}.hero{padding:22px;margin-bottom:18px}.hero h1{margin:0 0 8px;font-size:clamp(1.75rem,7vw,2.35rem);line-height:1.15;overflow-wrap:anywhere}.hero p,.muted{color:#a9c1c9}.badge{display:inline-block;margin-top:8px;padding:6px 10px;border:1px solid #2cc9dc;border-radius:999px;color:#65eaff}.report-section{padding:18px;margin:14px 0}.report-section h2{margin:0 0 8px;color:#65eaff;font-size:clamp(1.25rem,5.6vw,1.55rem);line-height:1.2;overflow-wrap:anywhere}.report-section>.muted{margin:0 0 12px}.hero,.report-section,.data-row,.data-label,.data-value{min-width:0}.data-row{display:grid;grid-template-columns:minmax(150px,230px) minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid #173038}.data-row:last-child{border-bottom:0}.data-label{font-weight:700;color:#b9d2d8}.data-value{overflow-wrap:anywhere}@media(max-width:640px){.wrap{padding:18px 10px 40px}.hero{padding:16px}.report-section{padding:15px}.data-row{grid-template-columns:minmax(0,1fr);gap:3px}}@media print{body{background:white;color:black}.hero,.report-section{background:white;border-color:#bbb}.report-section h2,.badge{color:black;border-color:#777}.hero p,.muted,.data-label{color:#444}}
</style>
</head>
<body><main class="wrap">
<section class="hero"><h1>Your GeminiScanner account data</h1><p>This is a simple summary of the customer information most useful to you. Technical metadata, internal IDs, device details, IP addresses, and system-only records are left out. The separate technical JSON export still contains the full protected export when needed.</p><span class="badge">Generated ${escapeHtml(generatedAt)}</span></section>
${reportSections}
</main></body></html>`;

  res.set('Content-Disposition', `attachment; filename="geminiscanner-my-data-${safeId}.html"`);
  return res.status(200).type('html').send(html);
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
      exitWebsiteEnabled: req.body?.exitWebsiteEnabled,
      exitSoundEnabled: req.body?.exitSoundEnabled,
      exitEmailEnabled: req.body?.exitEmailEnabled,
      exitNotificationEmail: req.body?.exitNotificationEmail,
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
        ? 'New password must contain at least 8 characters.'
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
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const ownedMonitorSourceMod = await import('./scanner/customer_owned_position_monitor_source.mjs');
    const source = await getUnderFiveSharedSource();
    const now = new Date();
    const brokerEvidence = req.customerBrokerPerformanceEvidence ?? await fetchCustomerBrokerPerformanceEvidence({ fetchedPaperAccount: req.customerPaperAccountFetch, now });
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(brokerEvidence.fetchedPaperAccount);
    const ownedMarketSourceMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const ownedMonitorSource = await ownedMonitorSourceMod.fetchCustomerOwnedPositionMonitorSource({
      paperAccount,
      fetchSymbols: (options = {}) => ownedMarketSourceMod.fetchAlpacaUnderFiveUniverseReadonly({
        ...options,
        env: process.env,
      }),
    });
    const performanceReport = (await buildCustomerBrokerPerformanceReport({
      accountId: req.customerAccount?.id,
      evidence: brokerEvidence,
      paperAccount,
      period: req.query.period,
      now,
    })).performanceReport;
    const resultFilters = getCustomerZeroResultFilters(req.customerAccount?.id).filters;
    const requestedMaxPrice = Number(req.query.maxPrice);
    const maxPrice = [5, 10, 50, 100, 1000].includes(requestedMaxPrice) ? requestedMaxPrice : 5;
    const dashboard = viewMod.buildCustomerUnderFiveDashboard(source, {
      route: '/customer/scanner/under-five',
      resultFilters,
      paperAccount,
      ownedPositionCandidates: ownedMonitorSource.candidates,
      performanceReport,
      equity: paperAccount.accountHealthy ? paperAccount.account.equity : null,
      buyingPower: paperAccount.accountHealthy ? paperAccount.account.buyingPower : null,
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer',
      portfolioWindDownActive: req.customerAccount?.portfolioWindDownRequested === true,
      title: `$0–$${maxPrice.toLocaleString('en-US')} Scanner`,
      maxPrice,
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now,
    });
    res.set('Cache-Control', 'no-store');
    res.type('html').send(viewMod.renderCustomerUnderFiveDashboardHtml(dashboard, req.customerAccount));
  } catch (_err) {
    res.status(500).type('html').send('<!doctype html><html><body><h1>Under $5 Scanner</h1><p>Unavailable.</p><p>Read-only. No execution controls.</p></body></html>');
  }
});



async function renderCustomerZeroPortfolioHub(req, res) {
  const mod = await import('./scanner/customer_scanner_hub.mjs');
  const portfolioMod = await import('./scanner/customer_zero_portfolio_summary.mjs');
  const now = new Date();
  const brokerPerformance = await buildCustomerBrokerPerformanceReport({
    period: req.query.period ?? 'lifetime',
    defaultPeriod: 'lifetime',
    now,
  });
  const paperAccount = brokerPerformance.paperAccount;
  const portfolioSummary = portfolioMod.buildCustomerZeroPortfolioSummary({ paperAccount });
  const performanceReport = brokerPerformance.performanceReport;
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
    const accountBridge = await import('./scanner/customer_zero_paper_account_bridge.mjs');
    const ownedMonitorSourceMod = await import('./scanner/customer_owned_position_monitor_source.mjs');
    const source = await getUnderFiveSharedSource();
    const now = new Date();
    const brokerEvidence = await fetchCustomerBrokerPerformanceEvidence({ now });
    const paperAccount = accountBridge.buildCustomerZeroPaperAccountBridge(brokerEvidence.fetchedPaperAccount);
    const ownedMarketSourceMod = await import('./scanner/alpaca_under_five_universe_readonly.mjs');
    const ownedMonitorSource = await ownedMonitorSourceMod.fetchCustomerOwnedPositionMonitorSource({
      paperAccount,
      fetchSymbols: (options = {}) => ownedMarketSourceMod.fetchAlpacaUnderFiveUniverseReadonly({
        ...options,
        env: process.env,
      }),
    });
    const performanceReport = (await buildCustomerBrokerPerformanceReport({
      evidence: brokerEvidence,
      paperAccount,
      period: req.query.period,
      now,
    })).performanceReport;
    const requestedMaxPrice = Number(req.query.maxPrice);
    const maxPrice = [5, 10, 50, 100, 1000].includes(requestedMaxPrice) ? requestedMaxPrice : 5;
    const dashboard = viewMod.buildCustomerZeroUnderFiveDashboard(source, {
      route: '/customer-zero/under-five-scanner',
      paperAccount,
      ownedPositionCandidates: ownedMonitorSource.candidates,
      performanceReport,
      equity: paperAccount.accountHealthy ? paperAccount.account.equity : null,
      buyingPower: paperAccount.accountHealthy ? paperAccount.account.buyingPower : null,
      role: 'customer',
      roleLabel: 'Customer',
      tenant: 'customer-zero',
      title: `$0–$${maxPrice.toLocaleString('en-US')} Scanner`,
      maxPrice,
      refreshIntervalSec: req.query.refreshIntervalSec ?? req.query.refresh,
      now,
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
