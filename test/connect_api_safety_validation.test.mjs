import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("scripts/connect_api_safety_validation.mjs", "utf8");

test("connect safety token storage detector is line bounded and oauth-token specific", () => {
  assert.match(source, /TOKEN_STORAGE/);
  assert.ok(source.includes("[^\\r\\n]{0,120}"));
  assert.match(source, /access\[_ -\]\?token/);
  assert.match(source, /refresh\[_ -\]\?token/);
  assert.match(source, /oauth\[_ -\]\?token/);
  assert.doesNotMatch(source, /save\.\*token\|store\.\*token\|token\.\*database\|refresh\.\*token/);
});

test("connect safety findings include bounded match evidence", () => {
  assert.match(source, /match: String\(match\[0\]\)\.slice\(0, 240\)/);
});
