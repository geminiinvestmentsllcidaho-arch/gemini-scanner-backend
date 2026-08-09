import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const targets = [
  "src/scanner/paper_app_broker_readiness_index_app_screen.mjs",
  "src/scanner/paper_app_route_health_status_app_screen.mjs",
  "src/scanner/paper_broker_runtime_environment_preflight_app_screen.mjs",
  "src/scanner/paper_readiness_gate_app_screen.mjs",
];

test("paper app target screens include capitalized related broker readiness routes", () => {
  for (const target of targets) {
    const text = fs.readFileSync(target, "utf8");
    assert.match(text, /Related Broker Readiness Routes/, target);
  }
});
