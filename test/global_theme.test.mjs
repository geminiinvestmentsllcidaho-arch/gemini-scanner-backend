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
    assert.match(css, /data-gs-global-theme="geminiscanner_global_theme_v4"/);
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
  assert.match(layer, /\/assets\/GeminiScanner-Logo\.jpg/);
  assert.doesNotMatch(layer, /role="img"/);
});

test("shared customer header contains branding only", () => {
  const html = renderGlobalHeader({ surface: "customer", homeHref: "/customer" });
  assert.match(html, /href="\/customer"/);
  assert.match(html, /GeminiScanner/);
  assert.doesNotMatch(html, /\/admin\b|broker|Place order|Buy now/i);
});

test("saved theme and density selections visibly override legacy page styles while preserving the background logo", () => {
  const css = renderGlobalThemeCss({ surface: "customer" });
  const layer = renderBackgroundLogoLayer();

  assert.match(css, /html\[data-gs-theme="light"\] body/);
  assert.match(css, /html\[data-gs-theme="light"\] \.card/);
  assert.match(css, /html\[data-gs-theme="light"\] input/);
  assert.match(css, /html\[data-gs-density="compact"\] main/);
  assert.match(css, /html\[data-gs-density="compact"\] \.card/);
  assert.match(css, /html\[data-gs-reduced-motion="true"\]/);

  assert.match(css, /html\[data-gs-theme="light"\] \.gs-background-logo img/);
  assert.match(css, /\.gs-background-logo\{position:fixed/);
  assert.match(css, /pointer-events:none/);
  assert.match(layer, /class="gs-background-logo"/);
  assert.match(layer, /\/assets\/GeminiScanner-Logo\.jpg/);
});


test("uses Oxanium for display text and Space Grotesk for interface text", () => {
  const css = renderGlobalThemeCss({ surface: "customer" });
  assert.match(css, /family=Oxanium/);
  assert.match(css, /family=Space\+Grotesk/);
  assert.match(css, /--gs-font-display:"Oxanium"/);
  assert.match(css, /--gs-font-interface:"Space Grotesk"/);
  assert.match(css, /body\{[^}]*font-family:var\(--gs-font-interface\)/);
  assert.match(css, /h1,h2,h3,h4,h5,h6,[^\{]*\{font-family:var\(--gs-font-display\)/);
});
