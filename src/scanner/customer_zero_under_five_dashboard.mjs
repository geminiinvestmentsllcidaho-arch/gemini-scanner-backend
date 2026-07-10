import {
  buildAlpacaUnderFiveUniverseAppCard,
  renderAlpacaUnderFiveUniverseAppCardHtml,
} from "./alpaca_under_five_universe_app_card.mjs";

export const VERSION = "customer_zero_under_five_dashboard_v1";

export function buildCustomerZeroUnderFiveDashboard(source = {}, options = {}) {
  const card = buildAlpacaUnderFiveUniverseAppCard(source, options);

  return {
    ...card,
    version: VERSION,
    route: "/customer-zero/under-five-scanner",
    role: "customer_zero",
    roleLabel: "Customer Zero",
    title: "Customer Zero — Under $5 Scanner",
    headline: "Live read-only under-$5 scanner for visual testing",
    displayState: card.sourceStatus === "connected_readonly"
      ? "CUSTOMER_ZERO_UNDER_FIVE_SCANNER_CONNECTED_READONLY"
      : "CUSTOMER_ZERO_UNDER_FIVE_SCANNER_NOT_CONNECTED_READONLY",
    adminDiagnosticsHref: "/diagnostics/alpaca-under-five-universe-app-card",
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderCustomerZeroUnderFiveDashboardHtml(dashboard = {}) {
  const base = renderAlpacaUnderFiveUniverseAppCardHtml(dashboard);
  return base
    .replace(
      "<main class=\"wrap\">",
      `<main class="wrap">
      <section class="card" data-role-badge="customer-zero"><b>Role:</b> Customer Zero<br><b>Mode:</b> Read-only visual test<br><b>Route:</b> /customer-zero/under-five-scanner</section>`
    )
    .replace(
      "</main></body></html>",
      `<section class="card"><b>Customer Zero safety:</b> Decision assist only. No order placement or account mutation controls.</section></main></body></html>`
    );
}
