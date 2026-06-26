import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildApiPatchPlan } from "../scripts/plan_api_patch.mjs";

function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "api-patch-plan-"));
  fs.mkdirSync(path.join(root, "runs"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "marketdata"), { recursive: true });
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  return root;
}

test("buildApiPatchPlan creates monitor-only market data plan", () => {
  const root = makeTempRepo();
  fs.writeFileSync(path.join(root, "runs", "alpaca_api_watch_report.json"), JSON.stringify({
    changed: true,
    docs: ["Market Data bars endpoint updated for stocks snapshots"],
    status: "operational"
  }));
  fs.writeFileSync(path.join(root, "src", "marketdata", "alpaca_client.mjs"), "export const marketDataBars = true;\n");

  const plan = buildApiPatchPlan({ rootDir: root });

  assert.equal(plan.ok, true);
  assert.equal(plan.mode, "monitor_only_patch_planner");
  assert.equal(plan.rules.autoPatching, false);
  assert.equal(plan.changeDetected, true);

  const market = plan.areas.find((area) => area.area === "market_data");
  assert.equal(market.detected, true);
  assert.equal(market.riskLevel, "medium");
  assert.equal(market.approvalRequired, true);
  assert.ok(market.likelyImpactedFiles.includes("src/marketdata/alpaca_client.mjs"));
  assert.ok(plan.globalValidationCommands.includes("npm run validate:all"));
  assert.ok(fs.existsSync(path.join(root, "runs", "alpaca_api_patch_plan.json")));
});

test("buildApiPatchPlan marks Connect/account connection changes high risk", () => {
  const root = makeTempRepo();
  fs.writeFileSync(path.join(root, "runs", "alpaca_api_watch_report.json"), JSON.stringify({
    changed: true,
    connect: {
      accountConnection: "account connection consent token docs changed",
      clientSecret: "client secret handling reference changed"
    }
  }));
  fs.writeFileSync(path.join(root, "scripts", "validate_connect_safety.mjs"), "console.log('account connection consent client secret safety');\n");

  const plan = buildApiPatchPlan({ rootDir: root });

  const connect = plan.areas.find((area) => area.area === "account_connection_safety");
  assert.equal(connect.detected, true);
  assert.equal(connect.riskLevel, "high");
  assert.equal(connect.approvalRequired, true);
  assert.equal(plan.highestRisk, "high");
  assert.equal(plan.userApprovalRequired, true);
  assert.ok(connect.validationCommands.includes("npm run validate:connect-safety"));
});

test("buildApiPatchPlan handles missing watcher report safely", () => {
  const root = makeTempRepo();

  const plan = buildApiPatchPlan({ rootDir: root });

  assert.equal(plan.ok, false);
  assert.equal(plan.changeDetected, false);
  assert.equal(plan.rules.autoPatching, false);
  assert.equal(plan.rules.autoProductionEdits, false);
  assert.equal(plan.userApprovalRequired, false);
  assert.ok(plan.summary.includes("skipped safely"));
  assert.ok(fs.existsSync(path.join(root, "runs", "alpaca_api_patch_plan.json")));
});
