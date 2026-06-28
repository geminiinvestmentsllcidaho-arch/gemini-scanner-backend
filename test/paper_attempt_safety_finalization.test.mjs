import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  PAPER_ATTEMPT_SAFETY_FINALIZATION_VERSION,
  buildPaperAttemptSafetyFinalization,
  writePaperAttemptSafetyFinalizationReport
} from "../src/scanner/paper_attempt_safety_finalization.mjs";

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "paper-attempt-safety-finalization-"));
  fs.mkdirSync(path.join(root, "runs"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    scripts: {
      "validate:trading-safety": "echo ok",
      "validate:all": "echo ok"
    }
  }, null, 2));
  return root;
}

test("paper attempt safety finalization keeps all trading safety locks closed", () => {
  const projectRoot = makeTempProject();
  const report = buildPaperAttemptSafetyFinalization({
    projectRoot,
    now: "2026-06-27T00:00:00.000Z"
  });

  assert.equal(report.ok, true);
  assert.equal(report.version, PAPER_ATTEMPT_SAFETY_FINALIZATION_VERSION);
  assert.equal(report.safety.decisionAssistOnly, true);
  assert.equal(report.safety.monitorOnly, true);
  assert.equal(report.safety.diagnosticsOnly, true);
  assert.equal(report.safety.liveTradingAllowed, false);
  assert.equal(report.safety.autoTradingAllowed, false);
  assert.equal(report.safety.accountMutationAllowed, false);
  assert.equal(report.safety.brokerOrderPlacementAllowed, false);
  assert.equal(report.safety.brokerContactAllowed, false);
  assert.deepEqual(report.safety.safetyIssues, []);
});

test("paper attempt safety finalization inventories latest artifacts without failing on missing files", () => {
  const projectRoot = makeTempProject();

  fs.writeFileSync(path.join(projectRoot, "runs", "manual_paper_trading_readiness_audit_2026.json"), "{}\n");
  fs.writeFileSync(path.join(projectRoot, "runs", "first_tiny_paper_order_control_path_2026.json"), "{}\n");

  const report = buildPaperAttemptSafetyFinalization({
    projectRoot,
    now: "2026-06-27T00:00:00.000Z"
  });

  assert.equal(report.artifacts.manualPaperTradingReadinessAudit.present, true);
  assert.equal(report.artifacts.firstTinyPaperOrderControlPath.present, true);
  assert.equal(report.artifacts.paperAttemptControlCenter.present, false);
  assert.ok(report.warnings.includes("artifact_not_found:paperAttemptControlCenter"));
});

test("paper attempt safety finalization writes JSON and compact handoff outputs", () => {
  const projectRoot = makeTempProject();

  const report = writePaperAttemptSafetyFinalizationReport({
    projectRoot,
    now: "2026-06-27T00:00:00.000Z"
  });

  assert.ok(report.output.jsonPath.endsWith(".json"));
  assert.ok(report.output.handoffPath.endsWith(".txt"));
  assert.equal(fs.existsSync(path.join(projectRoot, report.output.jsonPath)), true);
  assert.equal(fs.existsSync(path.join(projectRoot, report.output.handoffPath)), true);

  const handoff = fs.readFileSync(path.join(projectRoot, report.output.handoffPath), "utf8");
  assert.match(handoff, /BEGIN GEMINISCANNER COMPACT HANDOFF/);
  assert.match(handoff, /GS_RUN_B64_V1/);
  assert.match(handoff, /decision-assist/);
});
