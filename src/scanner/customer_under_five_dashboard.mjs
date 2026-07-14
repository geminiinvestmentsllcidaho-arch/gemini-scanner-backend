import {
  buildAlpacaUnderFiveUniverseAppCard,
} from "./alpaca_under_five_universe_app_card.mjs";
import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";
import {
  filterCustomerZeroResults,
  normalizeCustomerZeroResultFilters,
} from "./customer_zero_result_filters.mjs";
import { normalizeCustomerZeroResultState } from "./customer_zero_result_state.mjs";
import {
  buildCustomerZeroDecisionCards,
  renderCustomerZeroDecisionCardsHtml,
} from "./customer_zero_decision_cards.mjs";
import { buildCustomerZeroReadonlyAllocationPreview } from "./customer_zero_readonly_allocation_preview.mjs";
import { buildCustomerZeroPaperEnterExitGate } from "./customer_zero_paper_enter_exit_gate.mjs";
import { buildCustomerZeroPerformanceReport } from "./customer_zero_performance_report.mjs";

export const VERSION = "customer_under_five_dashboard_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerUnderFiveDashboard(source = {}, options = {}) {
  const route = String(options.route ?? "/customer/scanner/under-five");
  const role = String(options.role ?? "customer");
  const roleLabel = String(options.roleLabel ?? "Customer");
  const tenant = String(options.tenant ?? "customer");
  const title = String(options.title ?? "Under $5 Scanner");
  const resultFilters = normalizeCustomerZeroResultFilters(options.resultFilters);
  const filteredCandidates = filterCustomerZeroResults(source.candidates, resultFilters)
    .map((candidate) => ({
      ...candidate,
      resultState: normalizeCustomerZeroResultState(candidate).state,
    }));
  const filteredSource = {
    ...source,
    candidates: filteredCandidates,
    candidateCount: filteredCandidates.length,
  };
  const card = buildAlpacaUnderFiveUniverseAppCard(filteredSource, {
    ...options,
    detailBaseHref: route,
  });
  const candidates = card.candidates.map((candidate, index) => {
    const sourceCandidate = filteredCandidates[index] ?? candidate;
    return {
      ...candidate,
      resultState: sourceCandidate?.resultState
        ?? normalizeCustomerZeroResultState(candidate).state,
      allocationPreview: buildCustomerZeroReadonlyAllocationPreview(sourceCandidate, {
        buyingPower: options.buyingPower,
        availableFundsPct: options.availableFundsPct,
        maxDollarsPerStock: options.maxDollarsPerStock,
      }),
    };
  });
  const gatedCandidates = candidates.map((candidate) => ({
    ...candidate,
    paperEnterExitGate: buildCustomerZeroPaperEnterExitGate(candidate, {
      paperAccount: options.paperAccount,
      allocationPreview: candidate.allocationPreview,
      marketOpen: options.marketOpen ?? source?.marketClock?.isOpen,
      paperExecutionEnabled: options.paperExecutionEnabled,
      operatorApproved: options.operatorApproved,
      killSwitchActive: options.killSwitchActive,
      duplicateOrderDetected: options.duplicateOrderDetected,
      priceDeviationOk: options.priceDeviationOk,
      spreadLiquidityOk: options.spreadLiquidityOk,
      maxSourceAgeSec: options.maxSourceAgeSec,
    }),
  }));
  const { diagnosticsOnly: _diagnosticsOnly, ...customerCard } = card;
  const performanceReport = options.performanceReport
    ?? buildCustomerZeroPerformanceReport({
      period: options.performancePeriod ?? "daily",
      sourceTs: options.performanceSourceTs ?? options.now?.toISOString?.() ?? null,
      stale: options.performanceStale === true,
      paperAccount: options.paperAccount,
      paperLedger: options.paperLedger,
      paperLedgerHistory: options.paperLedgerHistory,
      now: options.now,
    });

  return {
    ...customerCard,
    candidates: gatedCandidates,
    candidateCount: gatedCandidates.length,
    resultFilters,
    performanceReport,
    paperAccount: options.paperAccount ?? {
      connected: false,
      accountHealthy: false,
      status: "blocked_readonly",
      displayState: "CUSTOMER_ZERO_PAPER_ACCOUNT_BLOCKED_READONLY",
      account: {
        cash: null,
        buyingPower: null,
        equity: null,
        portfolioValue: null,
        currency: "USD",
        accountStatus: "unknown",
        patternDayTrader: false,
        tradingBlocked: false,
        accountBlocked: false,
      },
      positions: [],
      summary: {
        positionsCount: 0,
        totalMarketValue: 0,
        totalUnrealizedPl: 0,
        operatorMessage: "Paper account data is unavailable.",
      },
      ledger: {
        finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
        readyForOrderPlacement: false,
        noExecutableOrder: true,
        noBrokerContact: true,
        noAccountMutation: true,
      },
      issues: ["PAPER_ACCOUNT_NOT_CONNECTED"],
      readOnly: true,
      paperOnly: true,
      decisionAssistOnly: true,
      orderPlacementAllowed: false,
      brokerContactAllowed: false,
      accountMutationAllowed: false,
    },
    allocationControls: {
      availableFundsPct: candidates[0]?.allocationPreview?.controls?.availableFundsPct ?? 5,
      maxDollarsPerStock: candidates[0]?.allocationPreview?.controls?.maxDollarsPerStock ?? 25,
      buyingPower: candidates[0]?.allocationPreview?.limits?.buyingPower ?? null,
      readOnly: true,
      previewOnly: true,
    },
    version: VERSION,
    route,
    role,
    roleLabel,
    tenant,
    title,
    headline: "Live read-only under-$5 scanner",
    displayState: card.sourceStatus === "connected_readonly"
      ? "CUSTOMER_UNDER_FIVE_SCANNER_CONNECTED_READONLY"
      : "CUSTOMER_UNDER_FIVE_SCANNER_NOT_CONNECTED_READONLY",
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderCustomerUnderFiveDashboardHtml(dashboard = {}) {
  const cards = buildCustomerZeroDecisionCards(dashboard.candidates);
  const rows = renderCustomerZeroDecisionCardsHtml(cards);
  const refreshSec = Number.isFinite(Number(dashboard.refreshIntervalSec))
    ? Number(dashboard.refreshIntervalSec)
    : 30;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(dashboard.title)}</title>
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{padding:42px 14px 72px}.hero,.card,.decision-card{background:rgba(0,0,0,.72)!important;color:var(--gs-text)!important;border:1px solid var(--gs-line)}.wrap{max-width:820px;margin:auto}.hero,.card,.decision-card{background:#fff;border-radius:18px;padding:15px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:#fff}.performance-positive{border-left:8px solid #159447}.performance-negative{border-left:8px solid #c62020}.performance-neutral{border-left:8px solid #737983}.performance-periods{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.performance-periods a{padding:8px 10px;border-radius:999px;background:#eceff2;color:#111;text-decoration:none;font-weight:800}.performance-periods a.active{background:#111;color:#fff}.hero h1{margin:.2rem 0}.decision-card{border-left:8px solid #8a8f98}.decision-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.decision-card h2{margin:0;font-size:1.6rem}.company-name{margin:.15rem 0;color:#68707a}.state-badge{border-radius:999px;padding:9px 12px;font-weight:900;white-space:nowrap;background:#eceff2}.decision-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.decision-grid p{margin:0;padding:10px;background:#f6f7f8;border-radius:12px}.decision-grid b,.decision-grid span{display:block}.decision-grid span{margin-top:4px;font-weight:700}.timestamp{font-size:.9rem;color:#555}.reasons ul{margin:.35rem 0 .75rem;padding-left:1.2rem}.detail-link{display:block;text-align:center;padding:12px;border-radius:12px;background:#111;color:#fff;text-decoration:none;font-weight:850}.state-enter{border-left-color:#159447}.state-enter .state-badge{background:#dff7e7;color:#11652e}.state-exit{border-left-color:#c62020}.state-exit .state-badge{background:#ffe0e0;color:#8a1111}.state-wait,.state-watch{border-left-color:#d39b00}.state-wait .state-badge,.state-watch .state-badge{background:#fff2c8;color:#765800}.state-do-not-enter,.state-blocked,.state-stale-data{border-left-color:#c62020}.state-do-not-enter .state-badge,.state-blocked .state-badge,.state-stale-data .state-badge{background:#ffe0e0;color:#8a1111}.state-no-setup{border-left-color:#737983}.paper-control-preview{margin:12px 0;padding:12px;border-radius:14px;background:#f6f7f8}.paper-control{display:block;text-align:center;padding:13px;border-radius:12px;font-weight:950}.bright-green{background:#18a84a;color:#fff}.priority-red{background:#c62020;color:#fff}.exit-control-preview{border:2px solid #c62020}.enter-control-preview{border:2px solid #159447}@media(max-width:560px){.decision-grid{grid-template-columns:1fr}.decision-card-head{align-items:center}.state-badge{font-size:.8rem}}
</style></head><body data-gs-page="customer-under-five">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-page="under-five" data-tenant="${esc(dashboard.tenant ?? "customer")}">
<section class="hero"><h1>${esc(dashboard.title)}</h1><p>${esc(dashboard.headline)}</p><p><b>Mode:</b> Decision assist / read-only</p></section>
<section class="card" data-role-badge="customer"><b>Role:</b> ${esc(dashboard.roleLabel ?? "Customer")} | <b>Route:</b> ${esc(dashboard.route ?? "/customer/scanner/under-five")}<br><b>Selected states:</b> ${esc(dashboard.resultFilters?.states?.join(", ") || "All")} | <b>Results:</b> ${esc(dashboard.candidateCount)}<br><b>Refresh:</b> ${esc(refreshSec)}s | <b>Market:</b> ${dashboard?.marketClock?.isOpen === true ? "Open" : "Closed"}</section>

<section class="card paper-account"><b>Paper account — read only</b><p>Status: ${dashboard.paperAccount?.accountHealthy === true ? "Connected" : "Blocked"} | Buying power: $${esc(dashboard.paperAccount?.account?.buyingPower ?? "—")} | Cash: $${esc(dashboard.paperAccount?.account?.cash ?? "—")} | Positions: ${esc(dashboard.paperAccount?.summary?.positionsCount ?? 0)}</p><p>Ledger: ${esc(dashboard.paperAccount?.ledger?.finalDecision ?? "NO_GO_FOR_ORDER_PLACEMENT")} | No broker contact or account mutation.</p></section>
<section class="card allocation-controls"><b>Read-only allocation controls</b><p>Available funds: ${esc(dashboard.allocationControls?.availableFundsPct ?? 5)}% (0–80%, 5% steps) | Maximum per stock: $${esc(dashboard.allocationControls?.maxDollarsPerStock ?? 25)} ($5 steps)</p><p>Calculated previews only. No broker contact, order placement, or account mutation.</p></section>
${rows}
<section class="card"><b>Customer safety:</b> Decision assist only. No order placement, broker contact, or account mutation controls.</section>
</main>
${renderGlobalFooter()}
</body></html>`;
}

export const buildCustomerZeroUnderFiveDashboard = buildCustomerUnderFiveDashboard;
export const renderCustomerZeroUnderFiveDashboardHtml = renderCustomerUnderFiveDashboardHtml;
