import test from "node:test";
import assert from "node:assert/strict";
import {
  installAlpacaRequestAudit,
  getAlpacaRequestAudit,
  resetAlpacaRequestAudit,
} from "../../src/utils/alpaca_request_audit.mjs";

test("alpaca request audit captures x-request-id without secrets", async () => {
  const originalFetch = globalThis.fetch;
  delete globalThis[Symbol.for("gemini.alpacaRequestAuditInstalled")];

  globalThis.fetch = async () => new Response("{}", {
    status: 200,
    headers: {
      "x-request-id": "req_test_123",
      "content-type": "application/json",
    },
  });

  resetAlpacaRequestAudit();
  installAlpacaRequestAudit({ limit: 5 });

  await fetch("https://data.alpaca.markets/v2/stocks/bars?symbols=AAPL", {
    headers: {
      "APCA-API-KEY-ID": "SECRET_KEY_ID",
      "APCA-API-SECRET-KEY": "SECRET_VALUE",
      "x-safe-header": "ok",
    },
  });

  const audit = getAlpacaRequestAudit();
  assert.equal(audit.installed, true);
  assert.equal(audit.total, 1);
  assert.equal(audit.recent[0].requestId, "req_test_123");
  assert.equal(audit.recent[0].host, "data.alpaca.markets");
  assert.equal(audit.recent[0].path, "/v2/stocks/bars");
  assert.equal(audit.recent[0].headers["x-safe-header"], "ok");
  assert.equal(audit.recent[0].headers["apca-api-key-id"], undefined);
  assert.equal(audit.recent[0].headers["apca-api-secret-key"], undefined);

  globalThis.fetch = originalFetch;
  delete globalThis[Symbol.for("gemini.alpacaRequestAuditInstalled")];
});
