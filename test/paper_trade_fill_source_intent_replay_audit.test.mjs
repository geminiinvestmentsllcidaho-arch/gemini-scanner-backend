import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_REPLAY_WINDOW_MS,
  REASON,
  VERSION,
  auditPaperTradeFillSourceIntentReplays,
} from "../src/scanner/paper_trade_fill_source_intent_replay_audit.mjs";

const fill = (overrides = {}) => ({
  fillId: "fill-1",
  sourceTicketId: "ticket-1",
  sourceIntentId: "intent-1",
  createdAt: "2026-07-01T15:00:00.000Z",
  symbol: "SOFI",
  side: "buy",
  qty: 99,
  fillPrice: 10.1,
  ...overrides,
});

test("flags same-intent same-shape fills from different tickets inside bounded window", () => {
  const audit = auditPaperTradeFillSourceIntentReplays({
    fillRecords: [
      fill(),
      fill({ fillId: "fill-2", sourceTicketId: "ticket-2", createdAt: "2026-07-01T15:04:59.000Z" }),
    ],
  });

  assert.equal(audit.version, VERSION);
  assert.equal(audit.reason, REASON);
  assert.equal(audit.replayWindowMs, DEFAULT_REPLAY_WINDOW_MS);
  assert.equal(audit.possibleReplayCount, 1);
  assert.equal(audit.hasPossibleReplay, true);
  assert.deepEqual(audit.affectedTicketIds, ["ticket-1", "ticket-2"]);
  assert.deepEqual(audit.affectedIntentIds, ["intent-1"]);
  assert.deepEqual(audit.affectedSymbols, ["SOFI"]);
  assert.equal(audit.evidence[0].separationMs, 299000);
});

test("does not flag the same source ticket twice", () => {
  const audit = auditPaperTradeFillSourceIntentReplays({
    fillRecords: [fill(), fill({ fillId: "fill-2", createdAt: "2026-07-01T15:01:00.000Z" })],
  });
  assert.equal(audit.possibleReplayCount, 0);
  assert.equal(audit.hasPossibleReplay, false);
});

test("does not flag different intent, shape, price, or fills outside the window", () => {
  const audit = auditPaperTradeFillSourceIntentReplays({
    fillRecords: [
      fill(),
      fill({ fillId: "intent", sourceTicketId: "ticket-2", sourceIntentId: "intent-2", createdAt: "2026-07-01T15:01:00.000Z" }),
      fill({ fillId: "qty", sourceTicketId: "ticket-3", qty: 98, createdAt: "2026-07-01T15:02:00.000Z" }),
      fill({ fillId: "price", sourceTicketId: "ticket-4", fillPrice: 10.11, createdAt: "2026-07-01T15:03:00.000Z" }),
      fill({ fillId: "late", sourceTicketId: "ticket-5", createdAt: "2026-07-01T15:05:00.001Z" }),
    ],
  });
  assert.equal(audit.possibleReplayCount, 0);
});

test("requires complete deterministic source and timestamp evidence", () => {
  const audit = auditPaperTradeFillSourceIntentReplays({
    fillRecords: [
      fill({ sourceTicketId: null }),
      fill({ sourceIntentId: null }),
      fill({ createdAt: "bad-date" }),
      fill({ symbol: "" }),
      fill({ qty: 0 }),
      fill({ fillPrice: null }),
    ],
  });
  assert.equal(audit.normalizedRecordCount, 0);
  assert.equal(audit.invalidOrIncompleteRecordCount, 6);
  assert.equal(audit.possibleReplayCount, 0);
});

test("is flag-only and exposes explicit safety locks", () => {
  const input = [fill(), fill({ fillId: "fill-2", sourceTicketId: "ticket-2", createdAt: "2026-07-01T15:01:00.000Z" })];
  const snapshot = structuredClone(input);
  const audit = auditPaperTradeFillSourceIntentReplays({ fillRecords: input });

  assert.deepEqual(input, snapshot);
  assert.equal(audit.readOnly, true);
  assert.equal(audit.paperOnly, true);
  assert.equal(audit.recordsMutated, false);
  assert.equal(audit.positionsAdjusted, false);
  assert.equal(audit.brokerContact, false);
  assert.equal(audit.orderPlacement, false);
  assert.equal(audit.accountMutation, false);
});
