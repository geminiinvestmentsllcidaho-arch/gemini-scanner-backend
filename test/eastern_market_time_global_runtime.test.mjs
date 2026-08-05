import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("serves and injects the Eastern market-time formatter across HTML responses", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const asset = fs.readFileSync("public/assets/eastern-market-time.js", "utf8");

  assert.match(server, /app\.get\('\/assets\/eastern-market-time\.js'/);
  assert.match(server, /html\.includes\('\/assets\/eastern-market-time\.js'\)/);
  assert.match(server, /<script src="\/assets\/eastern-market-time\.js" defer><\/script>/);
  assert.match(asset, /timeZone: "America\/New_York"/);
  assert.match(asset, /weekday: "short"/);
  assert.match(asset, /timeZoneName: "short"/);
  assert.match(asset, /replace\(\/\\bEDT\\b\|\\bEST\\b\/g, "ET"\)/);
  assert.match(asset, /MutationObserver/);
  assert.match(asset, /new Date\(value\)/);
});

test("does not rewrite timestamps inside code or form-control content", () => {
  const asset = fs.readFileSync("public/assets/eastern-market-time.js", "utf8");
  for (const tag of ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "OPTION"]) {
    assert.match(asset, new RegExp(`"${tag}"`));
  }
});
