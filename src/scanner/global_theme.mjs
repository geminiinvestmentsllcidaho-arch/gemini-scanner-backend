import {
  GEMINI_SCANNER_LOGO_VERSION,
  renderGeminiScannerEmblemSvg,
  renderGeminiScannerHorizontalLogoSvg,
} from "./gemini_scanner_logo.mjs";

export const GLOBAL_THEME_VERSION = "geminiscanner_global_theme_v2";
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
:root{color-scheme:dark;--gs-bg:#020607;--gs-panel:rgba(5,14,18,.78);--gs-text:#edfaff;--gs-muted:#8ca7b2;--gs-accent:${accent};--gs-positive:#39ff14;--gs-negative:#ff3547;--gs-neutral:#78848b;--gs-border:transparent;--gs-page-pad:2.625rem;--gs-pad:1rem;--gs-gap:1rem;--gs-input-height:2.75rem}
html[data-gs-theme="light"]{color-scheme:light;--gs-bg:#f4f9fb;--gs-panel:rgba(255,255,255,.88);--gs-text:#071b24;--gs-muted:#506b7f;--gs-accent:#007f99;--gs-positive:#157f2d;--gs-negative:#b51f35;--gs-neutral:#65747d}
html[data-gs-theme="dark"]{color-scheme:dark}
@media(prefers-color-scheme:light){html:not([data-gs-theme="dark"]):not([data-gs-theme="light"]){color-scheme:light;--gs-bg:#f4f9fb;--gs-panel:rgba(255,255,255,.88);--gs-text:#071b24;--gs-muted:#506b7f;--gs-accent:#007f99;--gs-positive:#157f2d;--gs-negative:#b51f35;--gs-neutral:#65747d}}
html[data-gs-density="compact"]{--gs-page-pad:1.75rem;--gs-pad:.75rem;--gs-gap:.625rem;--gs-input-height:2.375rem}
html[data-gs-theme="light"] body,html[data-gs-theme="light"] main,html[data-gs-theme="light"] .wrap{background-color:transparent!important;color:var(--gs-text)!important}
html[data-gs-theme="light"] .card,html[data-gs-theme="light"] .panel,html[data-gs-theme="light"] section,html[data-gs-theme="light"] details,html[data-gs-theme="light"] .settings-toolbar,html[data-gs-theme="light"] .settings-group,html[data-gs-theme="light"] .signin-history{background:var(--gs-panel)!important;color:var(--gs-text)!important;border-color:color-mix(in srgb,var(--gs-accent) 22%,transparent)!important}
html[data-gs-theme="light"] input,html[data-gs-theme="light"] select,html[data-gs-theme="light"] textarea,html[data-gs-theme="light"] button,html[data-gs-theme="light"] .settings-secondary-nav a{background:color-mix(in srgb,var(--gs-panel) 88%,var(--gs-bg) 12%)!important;color:var(--gs-text)!important;border-color:color-mix(in srgb,var(--gs-accent) 24%,transparent)!important}
html[data-gs-theme="light"] .gs-background-logo img{opacity:.14;filter:drop-shadow(0 0 26px rgba(0,127,153,.20))}
html[data-gs-density="compact"] main,html[data-gs-density="compact"] .wrap{padding:var(--gs-page-pad)!important}
html[data-gs-density="compact"] .card,html[data-gs-density="compact"] .panel,html[data-gs-density="compact"] section,html[data-gs-density="compact"] details{padding:var(--gs-pad)!important;margin-bottom:var(--gs-gap)!important}
html[data-gs-density="compact"] .settings-group>summary{padding:.7rem .85rem!important}
html[data-gs-density="compact"] .settings-group>section{padding:var(--gs-pad)!important}
html[data-gs-reduced-motion="true"] *,html[data-gs-reduced-motion="true"] *::before,html[data-gs-reduced-motion="true"] *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}
*{box-sizing:border-box}html{background:var(--gs-bg)}body{margin:0;min-height:100vh;background:var(--gs-bg);color:var(--gs-text);font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;transition:background-color .18s ease,color .18s ease}body>*:not(.gs-background-logo){position:relative;z-index:2}a{color:var(--gs-accent)}button,input,select,textarea{font:inherit}input,select,textarea{min-height:var(--gs-input-height);background:color-mix(in srgb,var(--gs-panel) 88%,var(--gs-bg) 12%);color:var(--gs-text);border:0;border-radius:10px;padding:.625rem .75rem}button{border:0;border-radius:10px;background:color-mix(in srgb,var(--gs-accent) 18%,var(--gs-panel) 82%);color:var(--gs-text)}.gs-card,.card,.panel,section{background:var(--gs-panel);border:0;border-radius:16px;backdrop-filter:blur(12px)}html[data-gs-density="compact"] .card,html[data-gs-density="compact"] .panel,html[data-gs-density="compact"] section{padding:min(14px,var(--gs-pad))!important;margin-bottom:var(--gs-gap)!important}.gs-positive{color:#caffc2}.gs-negative,.gs-blocked{color:#ffd5da}.gs-neutral{color:var(--gs-muted)}.gs-logo-lockup{display:inline-flex;align-items:center;gap:10px;color:var(--gs-accent)}.gs-logo-wordmark{color:var(--gs-text);font-weight:900;letter-spacing:-.025em}.gs-background-logo{position:fixed;inset:0;z-index:0;pointer-events:none;display:grid;place-items:center;overflow:hidden}.gs-background-logo::after{content:"";position:absolute;inset:0;background:color-mix(in srgb,var(--gs-bg) 24%,transparent)}.gs-background-logo img{width:min(92vw,1180px);height:auto;max-height:88vh;object-fit:contain;opacity:.22;filter:drop-shadow(0 0 34px rgba(24,215,255,.28))}.gs-global-header{position:relative;z-index:5;display:flex;align-items:center;padding:14px 20px;background:color-mix(in srgb,var(--gs-bg) 86%,transparent);border-bottom:0;backdrop-filter:blur(14px)}.gs-global-header a{text-decoration:none}.gs-global-footer{padding:24px 18px;color:var(--gs-muted);text-align:center}@media(max-width:640px){.gs-global-header{padding:11px 13px}.gs-background-logo img{width:98vw;max-height:84vh;opacity:.18}.gs-logo-wordmark{font-size:15px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style><script>(()=>{try{const r=document.documentElement;const t=localStorage.getItem("gs.theme");const d=localStorage.getItem("gs.density");const m=localStorage.getItem("gs.reducedMotion");if(t==="dark"||t==="light")r.dataset.gsTheme=t;else delete r.dataset.gsTheme;if(d==="compact")r.dataset.gsDensity="compact";else delete r.dataset.gsDensity;if(m==="true")r.dataset.gsReducedMotion="true";else delete r.dataset.gsReducedMotion}catch(_){}})();</script>`;
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
