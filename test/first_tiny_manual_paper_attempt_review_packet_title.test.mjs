import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildPaperAttemptOperatorReviewPacketAppScreen } from "../src/scanner/paper_attempt_operator_review_packet_app_screen.mjs";

test("operator review packet app screen supports first tiny route title override", () => {
  const screen = buildPaperAttemptOperatorReviewPacketAppScreen({
    title: "First Tiny Manual Paper Attempt Review Packet",
    subtitle: "Read-only first tiny manual paper attempt review packet.",
    panel: {
      ok: false,
      version: "fixture_panel_v1",
      blockers: ["route_alias_review_only"],
      checklist: [],
    },
  });

  assert.equal(screen.title, "First Tiny Manual Paper Attempt Review Packet");
  assert.equal(screen.subtitle, "Read-only first tiny manual paper attempt review packet.");
  assert.equal(screen.readyForOrderPlacement, false);
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.brokerContactAllowed, false);
  assert.equal(screen.orderPlacementAllowed, false);
  assert.equal(screen.accountMutationAllowed, false);
});

test("first tiny route passes title override into the app screen", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  const start = server.indexOf('app.get("/app/first-tiny-manual-paper-attempt-review-packet"');
  assert.notEqual(start, -1);
  const end = server.indexOf("\n});", start);
  assert.notEqual(end, -1);
  const block = server.slice(start, end);
  assert.match(block, /title:\s*"First Tiny Manual Paper Attempt Review Packet"/);
  assert.match(block, /subtitle:\s*"Read-only first tiny manual paper attempt review packet\. No broker contact and no order placement\."/);
});
