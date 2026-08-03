import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("raw status and unavailable fallbacks use the shared global theme", () => {
  assert.match(source, /function renderThemedStatusPage/);
  assert.match(source, /renderGlobalThemeCss\(\{ surface \}\)/);
  assert.match(source, /renderBackgroundLogoLayer\(\)/);
  assert.match(source, /renderGlobalHeader\(\{ surface, homeHref/);
  assert.match(source, /renderGlobalFooter\(\)/);
  assert.match(source, /surface: 'customer', title: 'Portfolio unavailable'/);
  assert.match(source, /surface: 'customer', title: 'Reports unavailable'/);
  assert.doesNotMatch(source, /<!doctype html><html><body><main><h1>Portfolio unavailable/);
  assert.doesNotMatch(source, /<!doctype html><html><body><main><h1>Reports unavailable/);
});
