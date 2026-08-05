export const CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION = "customer_lifetime_earnings_banner_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function money(value, locale = "en-US") {
  const number = finite(value);
  if (number === null) return "No data yet";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
}

function percent(value, locale = "en-US") {
  const number = finite(value);
  if (number === null) return "No data yet";
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number)}%`;
}

export function renderCustomerLifetimeEarningsBanner(performance = null, { locale = "en-US" } = {}) {
  const total = finite(performance?.netAfterCosts ?? performance?.totalPl);
  const tone = total === null ? "neutral" : total > 0 ? "positive" : total < 0 ? "negative" : "neutral";
  const available = total !== null;
  return `<style data-gs-customer-lifetime-earnings="${CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION}">
.gs-lifetime-earnings-banner{position:relative;z-index:6;width:min(1180px,calc(100% - 28px));margin:14px auto 0;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:18px;background:color-mix(in srgb,var(--gs-panel) 92%,var(--gs-bg) 8%);border-radius:16px;backdrop-filter:blur(14px)}
.gs-lifetime-earnings-banner__label{margin:0;color:var(--gs-muted);font-size:.78rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.gs-lifetime-earnings-banner__total{display:block;margin-top:3px;font-family:var(--gs-font-display);font-size:clamp(1.35rem,3vw,2rem);font-weight:900}
.gs-lifetime-earnings-banner__total.positive{color:var(--gs-positive)}.gs-lifetime-earnings-banner__total.negative{color:var(--gs-negative)}.gs-lifetime-earnings-banner__total.neutral{color:var(--gs-text)}
.gs-lifetime-earnings-banner__metrics{display:grid;grid-template-columns:repeat(3,minmax(92px,1fr));gap:9px}
.gs-lifetime-earnings-banner__metric{padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--gs-bg) 48%,transparent)}
.gs-lifetime-earnings-banner__metric span{display:block;color:var(--gs-muted);font-size:.72rem;font-weight:700}.gs-lifetime-earnings-banner__metric strong{display:block;margin-top:2px;font-family:var(--gs-font-display);font-size:.92rem}
@media(max-width:720px){.gs-lifetime-earnings-banner{align-items:stretch;flex-direction:column}.gs-lifetime-earnings-banner__metrics{grid-template-columns:repeat(3,1fr)}}@media(max-width:440px){.gs-lifetime-earnings-banner__metrics{grid-template-columns:1fr}}
</style><section class="gs-lifetime-earnings-banner" data-gs-authenticated-only="true" aria-label="Lifetime earnings">
<div><p class="gs-lifetime-earnings-banner__label">Lifetime Earnings</p><strong class="gs-lifetime-earnings-banner__total ${tone}">${esc(money(total, locale))}</strong></div>
<div class="gs-lifetime-earnings-banner__metrics">
<div class="gs-lifetime-earnings-banner__metric"><span>Realized</span><strong>${esc(money(available ? performance?.realizedPl : null, locale))}</strong></div>
<div class="gs-lifetime-earnings-banner__metric"><span>Unrealized</span><strong>${esc(money(available ? performance?.unrealizedPl : null, locale))}</strong></div>
<div class="gs-lifetime-earnings-banner__metric"><span>Return</span><strong>${esc(percent(available ? performance?.totalReturnPct : null, locale))}</strong></div>
</div></section>`;
}

export function injectCustomerLifetimeEarningsBanner(html, bannerHtml) {
  const source = String(html ?? "");
  if (!source || !bannerHtml || source.includes('data-gs-authenticated-only="true"')) return source;
  const bodyMatch = source.match(/<body\b[^>]*>/i);
  if (!bodyMatch) return source;
  const insertionAt = bodyMatch.index + bodyMatch[0].length;
  return `${source.slice(0, insertionAt)}${bannerHtml}${source.slice(insertionAt)}`;
}

export default {
  CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION,
  renderCustomerLifetimeEarningsBanner,
  injectCustomerLifetimeEarningsBanner,
};
