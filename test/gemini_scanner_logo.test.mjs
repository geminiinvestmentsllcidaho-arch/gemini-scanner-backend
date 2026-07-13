import assert from "node:assert/strict";
import test from "node:test";

import {
  renderGeminiScannerBlackWhiteSvg,
  renderGeminiScannerEmbroiderySvg,
  renderGeminiScannerEmblemSvg,
  renderGeminiScannerFaviconSvg,
  renderGeminiScannerOneColorSvg,
} from "../src/scanner/gemini_scanner_logo.mjs";

test("renders solid merch-ready GeminiScanner logo variants", () => {
  for (const svg of [
    renderGeminiScannerEmblemSvg(),
    renderGeminiScannerOneColorSvg(),
    renderGeminiScannerBlackWhiteSvg(),
    renderGeminiScannerEmbroiderySvg(),
    renderGeminiScannerFaviconSvg(),
  ]) {
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(
      svg,
      /linearGradient|radialGradient|<filter|<script|xlink:href|href=["\']https?:/i
    );
  }
});

test("embroidery logo uses thick production-friendly geometry", () => {
  const svg = renderGeminiScannerEmbroiderySvg();
  assert.match(svg, /stroke-width="5"/);
  assert.doesNotMatch(svg, /stroke-width="[012](?:\.\d+)?"/);
});
