import {
  GEMINI_SCANNER_LOGO_VERSION,
  renderGeminiScannerEmblemSvg,
  renderGeminiScannerHorizontalLogoSvg,
} from "./gemini_scanner_logo.mjs";

export const GLOBAL_THEME_VERSION = "geminiscanner_global_theme_v1";
export const GLOBAL_THEME_SURFACES = Object.freeze(["public", "customer", "admin", "internal"]);

function normalizeSurface(value) {
  return GLOBAL_THEME_SURFACES.includes(value) ? value : "public";
}

function escAttr(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function renderGlobalThemeCss({ surface = "public" } = {}) {
  const safeSurface = normalizeSurface(surface);
  const internal = safeSurface === "admin" || safeSurface === "internal";
  const accent = internal ? "#7aa2d8" : "#18d7ff";
  return `<style data-gs-global-theme="${GLOBAL_THEME_VERSION}" data-gs-surface="${safeSurface}">
:root{color-scheme:dark;--gs-bg:#020607;--gs-panel:rgba(5,14,18,.78);--gs-text:#edfaff;--gs-muted:#8ca7b2;--gs-accent:${accent};--gs-positive:#39ff14;--gs-negative:#ff3547;--gs-neutral:#78848b;--gs-border:rgba(24,215,255,.34)}
*{box-sizing:border-box}html{background:var(--gs-bg)}body{margin:0;min-height:100vh;background:#020607;color:var(--gs-text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}body>*:not(.gs-background-logo){position:relative;z-index:2}a{color:var(--gs-accent)}button,input,select,textarea{font:inherit}.gs-card,.card,.panel,section{background:var(--gs-panel);border:1px solid var(--gs-border);border-radius:16px;backdrop-filter:blur(12px)}.gs-positive{border-color:#39ff14;color:#caffc2}.gs-negative,.gs-blocked{border-color:#ff3547;color:#ffd5da}.gs-neutral{border-color:#78848b}.gs-logo-lockup{display:inline-flex;align-items:center;gap:10px;color:var(--gs-accent)}.gs-logo-wordmark{color:var(--gs-text);font-weight:900;letter-spacing:-.025em}.gs-background-logo{position:fixed;inset:0;z-index:0;pointer-events:none;display:grid;place-items:center;overflow:hidden}.gs-background-logo::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,.24)}.gs-background-logo img{width:min(92vw,1180px);height:auto;max-height:88vh;object-fit:contain;opacity:.22;filter:drop-shadow(0 0 34px rgba(24,215,255,.28))}.gs-global-header{position:relative;z-index:5;display:flex;align-items:center;padding:14px 20px;background:rgba(2,6,7,.86);border-bottom:1px solid var(--gs-border);backdrop-filter:blur(14px)}.gs-global-header a{text-decoration:none}.gs-global-footer{padding:24px 18px;color:var(--gs-muted);text-align:center}@media(max-width:640px){.gs-global-header{padding:11px 13px}.gs-background-logo img{width:98vw;max-height:84vh;opacity:.18}.gs-logo-wordmark{font-size:15px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>`;
}

export function renderBackgroundLogoLayer() {
  return `<div class="gs-background-logo" data-gs-logo-version="${GEMINI_SCANNER_LOGO_VERSION}" aria-hidden="true"><img src="/assets/GeminiScanner-Logo.jpg" alt="" aria-hidden="true"></div>`;
}

export function renderGlobalHeader({ surface = "public", homeHref = "/", label = "GeminiScanner" } = {}) {
  const safeSurface = normalizeSurface(surface);
  return `<header class="gs-global-header" data-gs-surface="${safeSurface}"><a href="${escAttr(homeHref)}" aria-label="${escAttr(label)} home"><img class="gs-brand-logo" src="/assets/GeminiScanner-Logo.jpg" width="42" height="42" alt="GeminiScanner logo"><span class="gs-logo-wordmark">${escAttr(label)}</span></a></header>`;
}

export function renderGlobalFooter() {
  return `<footer class="gs-global-footer">GeminiScanner decision-assist platform · Read only</footer>`;
}

export default {
  GLOBAL_THEME_VERSION,
  GLOBAL_THEME_SURFACES,
  renderGlobalThemeCss,
  renderBackgroundLogoLayer,
  renderGlobalHeader,
  renderGlobalFooter,
};
