import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_ACTIVATION_PHRASE,
  createStage1UnattendedOneSharePaperTransport,
} from "../src/scanner/stage1_unattended_one_share_paper_transport.mjs";

const order = Object.freeze({
  symbol: "AAPL",
  qty: 1,
  side: "buy",
  type: "market",
  timeInForce: "day",
  paperOnly: true,
});

const context = Object.freeze({
  idempotencyKey: "stage1-transport-proof",
  mode: "stage1_unattended_mechanical_proof",
  stopAfterSingleAttempt: true,
});

const enabledEnv = Object.freeze({
  STAGE1_UNATTENDED_PAPER_TRANSPORT_ENABLED: "1",
  STAGE1_UNATTENDED_PAPER_TRANSPORT_APPROVAL: REQUIRED_ACTIVATION_PHRASE,
  APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
  APCA_API_KEY_ID: "paper-key",
  APCA_API_SECRET_KEY: "paper-secret",
});

test("transport is disabled by default and performs no request", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperTransport({
    env: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error("request must not run");
    },
  });
  const result = await built.transport(order, context);
  assert.equal(calls, 0);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("stage1_unattended_paper_transport_disabled"));
  assert.equal(result.networkAttempted, false);
  assert.equal(result.orderSubmitAttempted, false);
  assert.equal(result.orderSubmitted, false);
  assert.equal(built.diagnostics().safety.liveTradingAllowed, false);
  assert.equal(built.diagnostics().safety.retryAllowed, false);
});

test("transport rejects non-paper host and invalid locked order without a request", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperTransport({
    env: {
      ...enabledEnv,
      APCA_API_BASE_URL: "https://api.alpaca.markets",
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    },
  });
  const result = await built.transport({ ...order, qty: 2 }, context);
  assert.equal(calls, 0);
  assert.ok(result.blockers.includes("quantity_must_equal_one"));
  assert.ok(result.blockers.includes("alpaca_paper_host_required"));
  assert.equal(result.networkAttempted, false);
});

test("enabled transport submits exactly one locked paper order", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperTransport({
    env: enabledEnv,
    fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url, "https://paper-api.alpaca.markets/v2/orders");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["APCA-API-KEY-ID"], "paper-key");
      assert.equal(options.headers["APCA-API-SECRET-KEY"], "paper-secret");
      const payload = JSON.parse(options.body);
      assert.equal(payload.symbol, "AAPL");
      assert.equal(payload.qty, "1");
      assert.equal(payload.side, "buy");
      assert.equal(payload.type, "market");
      assert.equal(payload.time_in_force, "day");
      assert.match(payload.client_order_id, /^gs-s1-stage1-transport-proof/);
      return new Response(JSON.stringify({ id: "paper-order-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await built.transport(order, context);
  assert.equal(calls, 1);
  assert.equal(result.status, "PAPER_ORDER_SUBMITTED");
  assert.equal(result.networkAttempted, true);
  assert.equal(result.orderSubmitAttempted, true);
  assert.equal(result.orderSubmitted, true);
  assert.equal(result.brokerOrderId, "paper-order-1");
  assert.equal(result.httpStatus, 200);
});

test("broker rejection remains a single completed attempt", async () => {
  let calls = 0;
  const built = createStage1UnattendedOneSharePaperTransport({
    env: enabledEnv,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ code: 40310000, message: "forbidden" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await built.transport(order, context);
  assert.equal(calls, 1);
  assert.equal(result.status, "PAPER_ORDER_REJECTED");
  assert.equal(result.networkAttempted, true);
  assert.equal(result.orderSubmitAttempted, true);
  assert.equal(result.orderSubmitted, false);
  assert.ok(result.blockers.includes("alpaca_paper_order_rejected"));
  assert.equal(result.httpStatus, 403);
});
