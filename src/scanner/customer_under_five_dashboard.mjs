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
  const noPriceCeiling = options.noPriceCeiling === true;
  const maxPrice = noPriceCeiling
    ? null
    : ([5, 10, 50, 100, 1000].includes(Number(options.maxPrice))
      ? Number(options.maxPrice)
      : 5);
  const title = String(options.title ?? (noPriceCeiling
    ? "Watchlist Scanner"
    : `$0–$${maxPrice.toLocaleString("en-US")} Scanner`));
  const resultFilters = normalizeCustomerZeroResultFilters(options.resultFilters);
  const priceFilteredCandidates = Array.isArray(source.candidates)
    ? source.candidates.filter((candidate) =>
        Number(candidate?.price) >= 0 &&
        (noPriceCeiling || Number(candidate?.price) <= maxPrice)
      )
    : [];
  const selectedStateLabels = Array.isArray(resultFilters.states)
    ? resultFilters.states
        .map((value) => String(value ?? "").replaceAll("_", " ").trim())
        .filter(Boolean)
    : [];
  const filteredCandidates = filterCustomerZeroResults(priceFilteredCandidates, resultFilters)
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
  const ownedSymbols = new Set(
    (Array.isArray(options.paperAccount?.positions) ? options.paperAccount.positions : [])
      .filter((position) => Number(position?.qty) > 0)
      .map((position) => String(position?.symbol ?? "").trim().toUpperCase())
      .filter(Boolean),
  );
  const priorityByState = Object.freeze({
    ENTER: 0,
    EXIT: 1,
    WATCH: 2,
    WAIT: 3,
    DO_NOT_ENTER: 4,
    BLOCKED: 5,
    STALE_DATA: 6,
    NO_SETUP: 7,
  });
  const prioritizedCandidates = gatedCandidates
    .filter((candidate) => {
      const state = String(candidate?.resultState ?? "NO_SETUP").toUpperCase();
      if (state !== "EXIT") return true;
      return ownedSymbols.has(String(candidate?.symbol ?? "").trim().toUpperCase());
    })
    .sort((left, right) => {
      const leftState = String(left?.resultState ?? "NO_SETUP").toUpperCase();
      const rightState = String(right?.resultState ?? "NO_SETUP").toUpperCase();
      const stateDelta = (priorityByState[leftState] ?? 99) - (priorityByState[rightState] ?? 99);
      if (stateDelta !== 0) return stateDelta;
      const confidenceDelta =
        Number(right?.readonlyPotentialScore ?? -1) - Number(left?.readonlyPotentialScore ?? -1);
      if (confidenceDelta !== 0) return confidenceDelta;
      return String(left?.symbol ?? "").localeCompare(String(right?.symbol ?? ""));
    });
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
    candidates: prioritizedCandidates,
    candidateCount: prioritizedCandidates.length,
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
    maxPrice,
    noPriceCeiling,
    selectedStateLabels,
    priceRangeLabel: noPriceCeiling ? "No price ceiling" : `$0–$${maxPrice.toLocaleString("en-US")}`,
    headline: noPriceCeiling
      ? "Live read-only watchlist scanner — no price ceiling"
      : `Live read-only $0–$${maxPrice.toLocaleString("en-US")} scanner`,
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

export function renderCustomerUnderFiveDashboardHtml(dashboard = {}, account = null) {
  const cards = buildCustomerZeroDecisionCards(dashboard.candidates);
  const rows = renderCustomerZeroDecisionCardsHtml(cards, account);
  const refreshSec = Number.isFinite(Number(dashboard.refreshIntervalSec))
    ? Number(dashboard.refreshIntervalSec)
    : 30;
  const marketOpen = dashboard?.marketClock?.isOpen === true;
  const marketLabel = marketOpen ? "MARKET OPEN" : "MARKET CLOSED";
  const nextOpenTimestamp = Date.parse(String(dashboard?.marketClock?.nextOpen ?? ""));
  const nextOpenLabel = Number.isFinite(nextOpenTimestamp)
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(nextOpenTimestamp))
    : "Unavailable";
  const resultRows = !marketOpen
    ? `<section class="card scanner-empty-state closed-market-empty-state"><b>Market closed.</b><p>Live scanner results are paused until the next market open.</p><p><b>Next market open:</b> ${esc(nextOpenLabel)}</p></section>`
    : Number(dashboard?.candidateCount ?? 0) > 0
      ? rows
      : '<section class="card scanner-empty-state"><b>No current matches.</b><p>No scanner decisions match the selected filters.</p></section>';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(dashboard.title)}</title>
${renderGlobalThemeCss({ surface: "customer" })}
<style>
.wrap{padding:42px 14px 72px}.hero,.card,.decision-card{background:rgba(0,0,0,.72)!important;color:var(--gs-text)!important;border:1px solid var(--gs-line)}.wrap{max-width:820px;margin:auto}.hero,.card,.decision-card{background:#fff;border-radius:18px;padding:15px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:#fff}.performance-positive{border-left:8px solid #159447}.performance-negative{border-left:8px solid #c62020}.performance-neutral{border-left:8px solid #737983}.performance-periods{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.performance-periods a{padding:8px 10px;border-radius:999px;background:#eceff2;color:#111;text-decoration:none;font-weight:800}.performance-periods a.active{background:#111;color:#fff}.hero h1{margin:.2rem 0}.decision-card{border-left:6px solid #8a8f98;padding:12px}.decision-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.decision-card h2{margin:0;font-size:1.45rem}.company-name{margin:.12rem 0;color:#c8d2d8;font-size:.88rem;font-weight:650}.state-badge{border-radius:999px;padding:7px 10px;font-size:.78rem;font-weight:900;white-space:nowrap;background:#eceff2}.decision-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.decision-grid p{margin:0;padding:8px;background:rgba(7,20,25,.94);border:1px solid rgba(24,215,255,.3);border-radius:10px;color:#f4fbff;min-width:0}.decision-grid b,.decision-grid span{display:block}.decision-grid b{font-size:.7rem;color:#9fdde8;text-transform:uppercase;letter-spacing:.03em}.decision-grid span{margin-top:3px;font-size:.9rem;font-weight:800;overflow-wrap:anywhere}.timestamp{margin:8px 0;font-size:.78rem;color:#c4d0d6}.reasons{font-size:.88rem}.reasons ul{margin:.25rem 0 .55rem;padding-left:1.1rem}.reasons li{margin:.16rem 0}.allocation-preview{margin:8px 0;padding:9px;border:1px solid rgba(57,255,32,.28);border-radius:12px;background:rgba(3,17,14,.78)}.allocation-preview>.decision-grid{margin-top:7px}.detail-link{display:block;text-align:center;padding:9px;border-radius:10px;background:rgba(24,215,255,.12);border:1px solid rgba(24,215,255,.5);color:#dffaff;text-decoration:none;font-weight:850}.state-enter{border-left-color:#159447}.state-enter .state-badge{background:#dff7e7;color:#11652e}.state-exit{border-left-color:#ff1f1f;box-shadow:0 0 18px rgba(255,31,31,.38)}.state-exit .state-badge{background:#ff1111;color:#fff;border:1px solid #ffb3b3;box-shadow:0 0 16px rgba(255,17,17,.78);animation:gs-exit-flash .8s steps(2,end) infinite}.state-wait,.state-watch{border-left-color:#d39b00}.state-wait .state-badge,.state-watch .state-badge{background:#fff2c8;color:#765800}.state-do-not-enter,.state-blocked,.state-stale-data{border-left-color:#c62020}.state-do-not-enter .state-badge,.state-blocked .state-badge,.state-stale-data .state-badge{background:#ffe0e0;color:#8a1111}.state-no-setup{border-left-color:#737983}.scan-status-bar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.scan-status-item{padding:12px 14px;border-radius:14px;border:1px solid var(--gs-line);background:rgba(0,0,0,.82);text-align:center;font-weight:950;letter-spacing:.04em}.market-open{color:#7dff9b;border-color:#18a84a;box-shadow:0 0 16px rgba(24,168,74,.28)}.market-closed{color:#ff2929;border-color:#ff1f1f;text-shadow:0 0 8px rgba(255,31,31,.95);box-shadow:0 0 22px rgba(255,31,31,.58)}.scan-countdown{color:#7be9ff;border-color:#18d7ff;box-shadow:0 0 16px rgba(24,215,255,.22)}.paper-control-preview{margin:12px 0;padding:12px;border-radius:14px;background:#f6f7f8}.paper-control{display:block;text-align:center;padding:13px;border-radius:12px;font-weight:950}.bright-green{background:#18a84a;color:#fff}.priority-red{background:#ff1111;color:#fff;border:1px solid #ffb3b3;box-shadow:0 0 18px rgba(255,17,17,.78);animation:gs-exit-flash .8s steps(2,end) infinite}.exit-control-preview{border:2px solid #ff1f1f;box-shadow:0 0 18px rgba(255,31,31,.42)}@keyframes gs-exit-flash{0%,48%{opacity:1;filter:brightness(1.35)}49%,100%{opacity:.35;filter:brightness(.72)}}@media(prefers-reduced-motion:reduce){.state-exit .state-badge,.priority-red{animation:none}}.enter-control-preview{border:2px solid #159447}@media(max-width:700px){.decision-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.scan-status-bar{grid-template-columns:1fr}}@media(max-width:420px){.decision-card{padding:10px}.decision-grid{gap:5px}.decision-grid p{padding:7px}.decision-card-head{align-items:center}.state-badge{font-size:.72rem}}
</style></head><body data-gs-page="customer-under-five" data-refresh-sec="${esc(refreshSec)}">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "customer", homeHref: "/customer", label: "GeminiScanner" })}
<main class="wrap" data-role="customer" data-page="under-five" data-tenant="${esc(dashboard.tenant ?? "customer")}">
<section class="hero"><h1>${esc(dashboard.title)}</h1><p>${esc(dashboard.headline)}</p><p><b>Mode:</b> Decision assist / read-only</p></section>
<section class="scan-status-bar" aria-label="Scanner timing and market status">
<div class="scan-status-item ${marketOpen ? "market-open" : "market-closed"}" data-market-status>${marketLabel}</div>
${marketOpen
  ? `<div class="scan-status-item scan-countdown">NEXT SCAN IN <span data-scan-countdown>${esc(refreshSec)}</span>s</div>`
  : `<div class="scan-status-item scan-countdown">SCANNER PAUSED<br><small>Next open: ${esc(nextOpenLabel)}</small></div>`}
</section>
<section class="card" data-role-badge="customer"><b>Role:</b> ${esc(dashboard.roleLabel ?? "Customer")} | <b>Price range:</b> ${esc(dashboard.priceRangeLabel ?? "$0–$10")}<br><b>Selected states:</b> ${esc((dashboard.selectedStateLabels ?? []).join(", ") || "All")} | <b>Results:</b> ${esc(dashboard.candidateCount)}<br><b>Refresh:</b> ${marketOpen ? `${esc(refreshSec)}s` : "Paused until market open"} | <b>Market:</b> ${marketOpen ? "Open" : "Closed"}</section>

<section class="card paper-account"><b>Paper account — read only</b><p>Status: ${dashboard.paperAccount?.accountHealthy === true ? "Connected" : "Blocked"} | Buying power: $${esc(dashboard.paperAccount?.account?.buyingPower ?? "—")} | Cash: $${esc(dashboard.paperAccount?.account?.cash ?? "—")} | Positions: ${esc(dashboard.paperAccount?.summary?.positionsCount ?? 0)}</p><p>Ledger: ${esc(String(dashboard.paperAccount?.ledger?.finalDecision ?? "NO GO FOR ORDER PLACEMENT").replaceAll("_", " "))} | No broker contact or account mutation.</p></section>
<section class="card allocation-controls"><b>Read-only allocation controls</b><p>Available funds: ${esc(dashboard.allocationControls?.availableFundsPct ?? 5)}% (0–80%, 5% steps) | Maximum per stock: $${esc(dashboard.allocationControls?.maxDollarsPerStock ?? 25)} ($5 steps)</p><p>Calculated previews only. No broker contact, order placement, or account mutation.</p></section>
${resultRows}
<section class="card"><b>Customer safety:</b> Decision assist only. No order placement, broker contact, or account mutation controls.</section>
</main>
${renderGlobalFooter()}
${marketOpen ? '<script src="/assets/customer-scanner-countdown.js" defer></script>' : ""}
</body></html>`;
}

export const buildCustomerZeroUnderFiveDashboard = buildCustomerUnderFiveDashboard;
export const renderCustomerZeroUnderFiveDashboardHtml = renderCustomerUnderFiveDashboardHtml;
