import test from "node:test";
import assert from "node:assert/strict";
import {
  BRAND_VERSION,
  injectGeminiScannerBrandHeader,
  renderGeminiScannerBrandHeader,
  renderGeminiScannerLogoSvg,
} from "../src/scanner/brand_header.mjs";

test("renders shared GeminiScanner logo and header", () => {
  assert.match(renderGeminiScannerLogoSvg(), /GeminiScanner logo/);
  assert.match(renderGeminiScannerLogoSvg(), /\/assets\/GeminiScanner-Logo\.jpg/);
  assert.match(renderGeminiScannerBrandHeader(), /GeminiScanner/);
  assert.match(renderGeminiScannerBrandHeader(), new RegExp(BRAND_VERSION));
});

test("injects shared brand header once", () => {
  const html = "<!doctype html><html><body><main>Page</main></body></html>";
  const once = injectGeminiScannerBrandHeader(html);
  assert.match(once, /data-gs-brand-version=/);
  assert.equal(injectGeminiScannerBrandHeader(once), once);
});

test("does not alter non-HTML", () => {
  assert.equal(injectGeminiScannerBrandHeader('{"ok":true}'), '{"ok":true}');
});
