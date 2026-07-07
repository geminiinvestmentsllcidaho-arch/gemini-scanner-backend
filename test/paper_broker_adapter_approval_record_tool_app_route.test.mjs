import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPaperBrokerAdapterApprovalRecordToolAppScreen,
  renderPaperBrokerAdapterApprovalRecordToolAppScreenHtml,
} from "../src/scanner/paper_broker_adapter_approval_record_tool_app_screen.mjs";

test("paper broker adapter approval record tool app screen is read-only and safe", async () => {
  const screen = await buildPaperBrokerAdapterApprovalRecordToolAppScreen({
    approvalRecordPath: "/no/such/file.jsonl",
    env: {},
  });

  assert.equal(screen.readOnly, true);
  assert.equal(screen.monitorOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
  assert.equal(screen.route, "/app/paper-broker-adapter-approval-record-tool");
  assert.deepEqual(screen.lockReasons, [
    "explicit_approval_record_missing",
    "broker_adapter_env_disabled",
    "broker_adapter_request_env_missing",
  ]);
});

test("paper broker adapter approval record tool html contains no mutation controls", async () => {
  const screen = await buildPaperBrokerAdapterApprovalRecordToolAppScreen({
    approvalRecordPath: "/no/such/file.jsonl",
    env: {},
  });
  const html = renderPaperBrokerAdapterApprovalRecordToolAppScreenHtml(screen);

  assert.match(html, /Paper Broker Adapter Approval Record Tool/);
  assert.match(html, /Related Broker Readiness Routes/);
  assert.match(html, /cannot contact a broker/i);
  assert.match(html, /cannot place orders/i);
  assert.match(html, /cannot mutate an account/i);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<button/i);
  assert.match(html, /\/diagnostics\/paper-broker-adapter-approval-record-tool/);
});
