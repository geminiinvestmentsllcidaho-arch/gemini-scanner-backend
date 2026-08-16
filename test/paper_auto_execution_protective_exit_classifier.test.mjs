import test from "node:test";
import assert from "node:assert/strict";
import { classifyProtectivePaperExitReason } from "../src/scanner/paper_auto_execution_protective_exit_classifier.mjs";

test("hard-loss owned EXIT is critical protective exit", () => {
  const result = classifyProtectivePaperExitReason("OWNED_POSITION_HARD_LOSS_REVIEW");
  assert.equal(result.protectiveExit, true);
  assert.equal(result.protectiveType, "hard_loss");
  assert.equal(result.priority, "critical");
  assert.equal(result.severity, "critical");
});

test("single and multi-share profit protection are protective exits", () => {
  for (const reason of [
    "OWNED_POSITION_SINGLE_SHARE_PROFIT_PROTECTION_EXIT",
    "OWNED_POSITION_MULTI_SHARE_PROFIT_PROTECTION_EXIT",
  ]) {
    const result = classifyProtectivePaperExitReason(reason);
    assert.equal(result.protectiveExit, true);
    assert.equal(result.protectiveType, "profit_protection");
    assert.equal(result.priority, "high");
    assert.equal(result.severity, "high");
  }
});

test("confirmed deterioration remains strategy exit rather than invented protective trigger", () => {
  const result = classifyProtectivePaperExitReason("OWNED_POSITION_CONFIRMED_DETERIORATION_REVIEW");
  assert.equal(result.protectiveExit, false);
  assert.equal(result.protectiveType, null);
  assert.equal(result.priority, "normal");
  assert.equal(result.severity, "normal");
});

test("unknown or missing reason fails closed to non-protective classification", () => {
  assert.equal(classifyProtectivePaperExitReason("UNKNOWN").protectiveExit, false);
  assert.equal(classifyProtectivePaperExitReason(null).protectiveExit, false);
});
