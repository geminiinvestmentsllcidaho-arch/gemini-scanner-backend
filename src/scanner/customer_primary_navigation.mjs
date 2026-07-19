export const CUSTOMER_PRIMARY_NAVIGATION_VERSION = "customer_primary_navigation_v1";

export const CUSTOMER_PRIMARY_NAVIGATION_ITEMS = Object.freeze([
  Object.freeze({ id: "overview", label: "Overview", href: "/customer" }),
  Object.freeze({ id: "scanner", label: "Scanner", href: "/customer/scanner" }),
  Object.freeze({ id: "watchlist", label: "Watchlist", href: "/customer/watchlist" }),
  Object.freeze({ id: "portfolio", label: "Portfolio", href: "/customer/portfolio" }),
  Object.freeze({ id: "reports", label: "Reports", href: "/customer/reports" }),
  Object.freeze({ id: "settings", label: "Settings", href: "/customer/settings" }),
]);

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderCustomerPrimaryNavigation({ active = "" } = {}) {
  const links = CUSTOMER_PRIMARY_NAVIGATION_ITEMS
    .map((item) => `<a href="${esc(item.href)}"${item.id === active ? ' aria-current="page"' : ""}>${esc(item.label)}</a>`)
    .join("");

  return `<nav class="customer-primary-nav" aria-label="Customer navigation">${links}</nav>`;
}

export function renderCustomerPrimaryNavigationCss() {
  return `<style data-gs-customer-primary-navigation="${CUSTOMER_PRIMARY_NAVIGATION_VERSION}">
.customer-primary-nav{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.customer-primary-nav a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;color:var(--gs-accent);text-decoration:none;border:0;border-radius:10px;padding:9px 12px;background:rgba(0,0,0,.58)}
.customer-primary-nav a[aria-current="page"]{color:var(--gs-text);background:rgba(24,215,255,.12);box-shadow:none}
@media(max-width:640px){.customer-primary-nav{gap:8px}.customer-primary-nav a{flex:1 1 calc(50% - 8px);padding:10px 8px}}
</style>`;
}

export default {
  CUSTOMER_PRIMARY_NAVIGATION_VERSION,
  CUSTOMER_PRIMARY_NAVIGATION_ITEMS,
  renderCustomerPrimaryNavigation,
  renderCustomerPrimaryNavigationCss,
};
