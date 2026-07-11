export const BRAND_VERSION = "geminiscanner_brand_header_v1";

export function renderGeminiScannerLogoSvg({ size = 38 } = {}) {
  const safeSize = Math.max(24, Math.min(96, Number(size) || 38));
  return `<svg class="gs-brand-logo" width="${safeSize}" height="${safeSize}" viewBox="0 0 64 64" role="img" aria-label="GeminiScanner logo" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="gsBrandGradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stop-color="#1597ff"/><stop offset="1" stop-color="#58d36b"/></linearGradient></defs>
<path d="M7 20V8H19M45 8h12v12M7 44v12h12M45 56h12V44" fill="none" stroke="url(#gsBrandGradient)" stroke-width="4" stroke-linecap="round"/>
<path d="M19 32c0-9 5-16 13-16 5 0 9 2 12 6l-7 6c-1-2-3-3-5-3-4 0-6 3-6 7s2 7 6 7c2 0 4-1 5-3l7 6c-3 4-7 6-12 6-8 0-13-7-13-16Z" fill="#1597ff"/>
<path d="M45 32c0 9-5 16-13 16-5 0-9-2-12-6l7-6c1 2 3 3 5 3 4 0 6-3 6-7s-2-7-6-7c-2 0-4 1-5 3l-7-6c3-4 7-6 12-6 8 0 13 7 13 16Z" fill="#58d36b" fill-opacity=".9"/>
<path d="M11 38h7v-8h7v15h7V25h7v7h7v-11h7" fill="none" stroke="#e8f2ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export function renderGeminiScannerBrandHeader() {
  return `<style data-gs-brand-style>
.gs-brand-header{position:relative;z-index:20;display:flex;align-items:center;gap:11px;padding:12px 18px;background:#07111f;border-bottom:1px solid #20314a;color:#eef5ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.gs-brand-header a{display:flex;align-items:center;gap:11px;color:inherit;text-decoration:none;font-weight:850;letter-spacing:-.02em}
.gs-brand-header span{font-size:18px}.gs-brand-logo{display:block;flex:none}
@media(max-width:520px){.gs-brand-header{padding:10px 13px}.gs-brand-header span{font-size:16px}}
</style><header class="gs-brand-header" data-gs-brand-version="${BRAND_VERSION}"><a href="https://geminiscanner.net/" aria-label="GeminiScanner home">${renderGeminiScannerLogoSvg()}<span>GeminiScanner</span></a></header>`;
}

export function injectGeminiScannerBrandHeader(html) {
  const source = String(html ?? "");
  if (!/<html[\s>]/i.test(source) || !/<body[\s>]/i.test(source)) return source;
  if (source.includes("data-gs-brand-version=")) return source;
  return source.replace(/<body([^>]*)>/i, `<body$1>${renderGeminiScannerBrandHeader()}`);
}
