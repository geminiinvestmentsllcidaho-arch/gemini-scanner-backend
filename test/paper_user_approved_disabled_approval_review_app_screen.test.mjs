import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ROUTE,
  buildPaperUserApprovedDisabledApprovalReviewAppScreen,
  renderPaperUserApprovedDisabledApprovalReviewAppScreenHtml,
} from "../src/scanner/paper_user_approved_disabled_approval_review_app_screen.mjs";

test("disabled Stage 2 approval review is read-only and cannot record approval", async () => {
  const screen = await buildPaperUserApprovedDisabledApprovalReviewAppScreen({}, 1_000_000);
  assert.equal(screen.route, ROUTE);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.previewOnly, true);
  assert.equal(screen.approvalControlsPresent, false);
  assert.equal(screen.approvalRecordingAllowed, false);
  assert.equal(screen.executionControlsPresent, false);
  assert.equal(screen.executionEnabled, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.stage3Locked, true);
  const html = renderPaperUserApprovedDisabledApprovalReviewAppScreenHtml(screen);
  assert.match(html, /No approval button/);
  assert.match(html, /No approval record is written/);
  assert.match(html, /No execution controls/);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
});

test("server and navigation register disabled approval review route", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const nav = fs.readFileSync("src/scanner/app_navigation_readonly.mjs", "utf8");
  assert.match(server, /app\.get\('\/app\/paper-user-approved-disabled-approval-review'/);
  assert.match(server, /paper_user_approved_disabled_approval_review_app_screen\.mjs/);
  assert.match(nav, /paper_user_approved_disabled_approval_review/);
  assert.match(nav, /\/app\/paper-user-approved-disabled-approval-review/);
});
