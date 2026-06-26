import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiPatchPlan, readApiPatchPlanForDashboard } from "../src/scanner/api_patch_plan_dashboard.mjs";

test("api patch plan dashboard normalizes planner fields safely", () => {
  const plan = normalizeApiPatchPlan({
    changeDetected: true,
    highestRisk: "MEDIUM",
    userApprovalRequired: true,
    affectedApiAreas: ["market-data", "trading"],
    likelyImpactedFiles: ["src/alpaca/client.mjs"],
    validationCommands: ["npm run validate:all"]
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.changeDetected, true);
  assert.equal(plan.highestRisk, "medium");
  assert.equal(plan.userApprovalRequired, true);
  assert.deepEqual(plan.affectedApiAreas, ["market-data", "trading"]);
  assert.deepEqual(plan.likelyImpactedFiles, ["src/alpaca/client.mjs"]);
  assert.deepEqual(plan.validationCommands, ["npm run validate:all"]);
});

test("api patch plan dashboard supplies safe defaults when plan is missing", async () => {
  const plan = await readApiPatchPlanForDashboard({
    filePath: "./runs/__missing_api_patch_plan_dashboard_test__.json"
  });

  assert.equal(plan.ok, false);
  assert.equal(plan.error, "PATCH_PLAN_NOT_FOUND");
  assert.equal(plan.userApprovalRequired, true);
  assert.ok(plan.validationCommands.includes("npm run validate:all"));
});
