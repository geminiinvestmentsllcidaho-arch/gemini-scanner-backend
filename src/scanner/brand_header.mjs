export const BRAND_VERSION = "geminiscanner_brand_header_v1";

export function renderGeminiScannerLogoSvg({ size = 38 } = {}) {
  const safeSize = Math.max(24, Math.min(96, Number(size) || 38));
  return `<img class="gs-brand-logo" src="/assets/GeminiScanner-Logo.jpg" width="${safeSize}" height="${safeSize}" alt="GeminiScanner logo">`;
}

export function renderGeminiScannerBrandHeader() {
  return `<style data-gs-brand-style>
.gs-brand-header{position:relative;z-index:20;display:flex;align-items:center;gap:11px;padding:12px 18px;background:#07111f;border-bottom:1px solid #20314a;color:#eef5ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.gs-brand-header a{display:flex;align-items:center;gap:11px;color:inherit;text-decoration:none;font-weight:850;letter-spacing:-.02em}
.gs-brand-header span{font-size:18px}.gs-brand-logo{display:block;flex:none;object-fit:cover;border-radius:10px;box-shadow:0 0 18px rgba(24,215,255,.28)}
@media(max-width:520px){.gs-brand-header{padding:10px 13px}.gs-brand-header span{font-size:16px}}
</style><header class="gs-brand-header" data-gs-brand-version="${BRAND_VERSION}"><a href="https://geminiscanner.net/" aria-label="GeminiScanner home">${renderGeminiScannerLogoSvg()}<span>GeminiScanner</span></a></header>`;
}

export function injectGeminiScannerBrandHeader(html) {
  const source = String(html ?? "");
  if (!/<html[\s>]/i.test(source) || !/<body[\s>]/i.test(source)) return source;
  if (source.includes("data-gs-brand-version=")) return source;
  return source.replace(/<body([^>]*)>/i, `<body$1>${renderGeminiScannerBrandHeader()}`);
}
