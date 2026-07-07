import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const route = "/app/paper-broker-adapter-approval-lock";
const title = "Paper Broker Adapter Approval Lock";
const markers = [
  "Related Broker Readiness Routes",
  "Paper App Broker Readiness Index",
  "Paper App Readiness Status",
  "Paper App Route Health Status",
  "Paper App Safety Lock Status",
  "Paper Trading Module Final Status",
  "Paper Trading Readiness Gate",
  "Paper Attempt Control Center",
  "Operator Approval"
];

test("all related paper app screens link the broker approval lock route", () => {
  const dir = "src/scanner";
  const files = fs.readdirSync(dir)
    .filter((name) => name.endsWith("_app_screen.mjs"))
    .map((name) => path.join(dir, name))
    .filter((file) => {
      const source = fs.readFileSync(file, "utf8");
      return markers.some((marker) => source.includes(marker));
    });

  assert.ok(files.length >= 32);

  const missing = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes(route) || !source.includes(title)) {
      missing.push(file);
    }
  }

  assert.deepEqual(missing, []);
});
