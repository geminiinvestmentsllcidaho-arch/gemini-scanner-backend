export const GEMINI_SCANNER_LOGO_VERSION = "gemini_scanner_logo_v1";

function safeSize(value, fallback = 40) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.max(16, Math.min(512, Math.round(number)))
    : fallback;
}

function svgAttrs({ size = 40, className = "gs-logo", hidden = false } = {}) {
  const dimension = safeSize(size);
  const safeClass = String(className).replace(/[^a-zA-Z0-9 _-]/g, "");
  if (hidden) {
    return `class="${safeClass}" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg"`;
  }
  return `class="${safeClass}" width="${dimension}" height="${dimension}" viewBox="0 0 64 64" role="img" aria-label="GeminiScanner logo" xmlns="http://www.w3.org/2000/svg"`;
}

export function renderGeminiScannerEmblemSvg(options = {}) {
  return `<svg ${svgAttrs(options)}>
<path d="M8 22V8h14M42 8h14v14M8 42v14h14M42 56h14V42" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="square"/>
<path d="M20 18h9l7 14-7 14h-9l7-14-7-14Zm24 0h-9l-7 14 7 14h9l-7-14 7-14Z" fill="currentColor"/>
<circle cx="32" cy="32" r="4" fill="none" stroke="currentColor" stroke-width="3"/>
</svg>`;
}

export function renderGeminiScannerHorizontalLogoSvg({
  size = 44,
  wordmark = "GeminiScanner",
  ...options
} = {}) {
  const safeWordmark = String(wordmark).replace(/[&<>"']/g, "");
  return `<span class="gs-logo-lockup">${renderGeminiScannerEmblemSvg({
    ...options,
    size,
    className: "gs-logo gs-logo-emblem",
  })}<span class="gs-logo-wordmark">${safeWordmark}</span></span>`;
}

export function renderGeminiScannerOneColorSvg(options = {}) {
  return renderGeminiScannerEmblemSvg({
    ...options,
    className: "gs-logo gs-logo-one-color",
  });
}

export function renderGeminiScannerBlackWhiteSvg(options = {}) {
  return renderGeminiScannerEmblemSvg({
    ...options,
    className: "gs-logo gs-logo-black-white",
  });
}

export function renderGeminiScannerEmbroiderySvg(options = {}) {
  return renderGeminiScannerEmblemSvg({
    ...options,
    className: "gs-logo gs-logo-embroidery",
  });
}

export function renderGeminiScannerFaviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#020607"/><path d="M9 22V9h13M42 9h13v13M9 42v13h13M42 55h13V42" fill="none" stroke="#18d7ff" stroke-width="5"/><path d="M20 18h9l7 14-7 14h-9l7-14-7-14Zm24 0h-9l-7 14 7 14h9l-7-14 7-14Z" fill="#18d7ff"/><circle cx="32" cy="32" r="4" fill="#39ff14"/></svg>`;
}

export default {
  GEMINI_SCANNER_LOGO_VERSION,
  renderGeminiScannerEmblemSvg,
  renderGeminiScannerHorizontalLogoSvg,
  renderGeminiScannerOneColorSvg,
  renderGeminiScannerBlackWhiteSvg,
  renderGeminiScannerEmbroiderySvg,
  renderGeminiScannerFaviconSvg,
};
