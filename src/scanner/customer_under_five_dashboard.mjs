import {
  buildAlpacaUnderFiveUniverseAppCard,
  renderAlpacaUnderFiveUniverseAppCardHtml,
} from "./alpaca_under_five_universe_app_card.mjs";

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
  const card = buildAlpacaUnderFiveUniverseAppCard(source, {
    ...options,
    detailBaseHref: route,
  });
  const { diagnosticsOnly: _diagnosticsOnly, ...customerCard } = card;

  return {
    ...customerCard,
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
  const base = renderAlpacaUnderFiveUniverseAppCardHtml(dashboard);
  return base
    .replace(
      '<main class="wrap">',
      `<main class="wrap" data-role="customer" data-tenant="${esc(dashboard.tenant ?? "customer")}"><section class="card" data-role-badge="customer"><b>Role:</b> ${esc(dashboard.roleLabel ?? "Customer")}<br><b>Mode:</b> Read-only<br><b>Route:</b> ${esc(dashboard.route ?? "/customer/scanner/under-five")}</section>`
    )
    .replace(
      "</main></body></html>",
      '<section class="card"><b>Customer safety:</b> Decision assist only. No order placement or account mutation controls.</section></main></body></html>'
    );
}

export const buildCustomerZeroUnderFiveDashboard = buildCustomerUnderFiveDashboard;
export const renderCustomerZeroUnderFiveDashboardHtml = renderCustomerUnderFiveDashboardHtml;
