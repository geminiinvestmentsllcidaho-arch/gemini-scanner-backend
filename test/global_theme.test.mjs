import assert from "node:assert/strict";
import test from "node:test";
import {
  renderBackgroundLogoLayer,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "../src/scanner/global_theme.mjs";

test("renders black neon public and customer theme foundations", () => {
  for (const surface of ["public", "customer"]) {
    const css = renderGlobalThemeCss({ surface });
    assert.match(css, /data-gs-global-theme="geminiscanner_global_theme_v1"/);
    assert.match(css, /--gs-bg:#020607/);
    assert.match(css, /--gs-accent:#18d7ff/);
    assert.match(css, /--gs-positive:#39ff14/);
    assert.match(css, /--gs-negative:#ff3547/);
  }
});

test("keeps admin and internal surfaces visually separate", () => {
  for (const surface of ["admin", "internal"]) {
    const css = renderGlobalThemeCss({ surface });
    assert.match(css, new RegExp(`data-gs-surface="${surface}"`));
    assert.match(css, /--gs-accent:#7aa2d8/);
    assert.doesNotMatch(css, /href="\/customer"/);
  }
});

test("background logo is fixed decorative and non interactive", () => {
  const css = renderGlobalThemeCss({ surface: "customer" });
  const layer = renderBackgroundLogoLayer();
  assert.match(css, /\.gs-background-logo\{position:fixed/);
  assert.match(css, /pointer-events:none/);
  assert.match(layer, /aria-hidden="true"/);
  assert.doesNotMatch(layer, /role="img"/);
});

test("shared customer header contains branding only", () => {
  const html = renderGlobalHeader({ surface: "customer", homeHref: "/customer" });
  assert.match(html, /href="\/customer"/);
  assert.match(html, /GeminiScanner/);
  assert.doesNotMatch(html, /\/admin\b|broker|Place order|Buy now/i);
});
