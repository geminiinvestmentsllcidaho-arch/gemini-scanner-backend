export const CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION = "customer_lifetime_earnings_banner_v2";

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

export function renderCustomerLifetimeEarningsBanner(
  performance = null,
  { locale = "en-US", detailed = false, marketClock = null } = {},
) {
  const total = finite(performance?.netAfterCosts ?? performance?.totalPl);
  const tone = total === null ? "neutral" : total > 0 ? "positive" : total < 0 ? "negative" : "neutral";
  const available = total !== null;
  const isOpen = marketClock?.isOpen === true;
  const target = isOpen ? marketClock?.nextClose : marketClock?.nextOpen;
  const countdownLabel = isOpen ? "Market closes in" : "Market opens in";
  const details = detailed
    ? `<div class="gs-lifetime-profit-banner__metrics" data-gs-lifetime-profit-details="true">
<div class="gs-lifetime-profit-banner__metric"><span>Realized</span><strong>${esc(money(available ? performance?.realizedPl : null, locale))}</strong></div>
<div class="gs-lifetime-profit-banner__metric"><span>Unrealized</span><strong>${esc(money(available ? performance?.unrealizedPl : null, locale))}</strong></div>
<div class="gs-lifetime-profit-banner__metric"><span>Return</span><strong>${esc(percent(available ? performance?.totalReturnPct : null, locale))}</strong></div>
</div>`
    : "";

  return `<style data-gs-customer-lifetime-earnings="${CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION}">
.gs-lifetime-profit-banner{position:relative;z-index:8;width:min(1180px,calc(100% - 28px));margin:8px auto 18px;padding:24px 22px;text-align:center;background:linear-gradient(145deg,rgba(4,20,25,.96),rgba(3,11,18,.96));border:1px solid rgba(24,215,255,.82);border-radius:20px;box-shadow:0 0 24px rgba(24,215,255,.18),inset 0 0 24px rgba(57,255,20,.035);backdrop-filter:blur(16px)}
.gs-lifetime-profit-banner__label{margin:0;color:#55dfff;font-family:var(--gs-font-display);font-size:.82rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.gs-lifetime-profit-banner__total{display:block;margin:6px 0 12px;font-family:var(--gs-font-display);font-size:clamp(2.6rem,9vw,5.25rem);line-height:1;font-weight:900;text-shadow:0 0 22px currentColor}
.gs-lifetime-profit-banner__total.positive{color:#39ff14}.gs-lifetime-profit-banner__total.negative{color:#ff3547}.gs-lifetime-profit-banner__total.neutral{color:var(--gs-text)}
.gs-market-countdown{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:34px;color:var(--gs-text);font-size:clamp(.92rem,2.8vw,1.12rem)}
.gs-market-countdown__clock{display:grid;place-items:center;width:28px;height:28px;border:2px solid #18d7ff;border-radius:50%;color:#18d7ff;font-size:.82rem}
.gs-market-countdown__value{font-family:var(--gs-font-display);font-variant-numeric:tabular-nums;font-weight:800;color:#dffaff}
.gs-lifetime-profit-banner__metrics{display:grid;grid-template-columns:repeat(3,minmax(100px,1fr));gap:10px;margin-top:20px;text-align:left}
.gs-lifetime-profit-banner__metric{padding:11px 13px;border:1px solid rgba(24,215,255,.16);border-radius:13px;background:rgba(0,0,0,.35)}
.gs-lifetime-profit-banner__metric span{display:block;color:var(--gs-muted);font-size:.74rem;font-weight:700}.gs-lifetime-profit-banner__metric strong{display:block;margin-top:3px;font-family:var(--gs-font-display);font-size:1rem}
@media(max-width:640px){.gs-lifetime-profit-banner{margin-top:6px;padding:22px 16px}.gs-lifetime-profit-banner__metrics{grid-template-columns:1fr}.gs-market-countdown{flex-wrap:wrap}}
</style><section class="gs-lifetime-profit-banner" data-gs-authenticated-only="true" aria-label="Lifetime profit">
<p class="gs-lifetime-profit-banner__label">Lifetime Profit</p>
<strong class="gs-lifetime-profit-banner__total ${tone}">${esc(money(total, locale))}</strong>
<div class="gs-market-countdown" data-gs-market-countdown data-mode="${isOpen ? "close" : "open"}" data-target="${esc(target ? String(target) : "")}">
<span class="gs-market-countdown__clock" aria-hidden="true">◷</span>
<span data-gs-market-countdown-label>${esc(countdownLabel)}</span>
<span class="gs-market-countdown__value" data-gs-market-countdown-value>${target ? "--:--:--" : "Unavailable"}</span>
</div>
${details}
<script src="/assets/customer-market-countdown.js" defer></script>
</section>`;
}

export function injectCustomerLifetimeEarningsBanner(html, bannerHtml) {
  const source = String(html ?? "");
  if (!source || !bannerHtml || source.includes('data-gs-authenticated-only="true"')) return source;

  const headerClassIndex = source.search(/class=["'][^"']*gs-(?:global|brand)-header\b[^"']*["']/i);
  if (headerClassIndex >= 0) {
    const headerCloseIndex = source.indexOf("</header>", headerClassIndex);
    if (headerCloseIndex >= 0) {
      const insertionAt = headerCloseIndex + "</header>".length;
      return `${source.slice(0, insertionAt)}${bannerHtml}${source.slice(insertionAt)}`;
    }
  }

  const bodyMatch = source.match(/<body\b[^>]*>/i);
  if (!bodyMatch || bodyMatch.index === undefined) return source;
  const insertionAt = bodyMatch.index + bodyMatch[0].length;
  return `${source.slice(0, insertionAt)}${bannerHtml}${source.slice(insertionAt)}`;
}

export default {
  CUSTOMER_LIFETIME_EARNINGS_BANNER_VERSION,
  renderCustomerLifetimeEarningsBanner,
  injectCustomerLifetimeEarningsBanner,
};
