import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchAlpacaPaperAccountReadonly,
} from "../src/scanner/alpaca_paper_account_readonly_fetch.mjs";

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(body); },
  };
}

test("readonly fetch uses encrypted tenant credentials when runtime env keys are absent", async () => {
  const calls = [];
  const result = await fetchAlpacaPaperAccountReadonly({
    env: { GEMINI_CREDENTIAL_MASTER_KEY: "m".repeat(64) },
    credentialResolver(options) {
      assert.equal(options.masterKey, "m".repeat(64));
      return {
        readyForReadonlyBrokerRead: true,
        env: {
          ALPACA_KEY: "encrypted-key",
          ALPACA_SECRET: "encrypted-secret",
          APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
        },
      };
    },
    async fetchImpl(url, options) {
      calls.push({ url, options });
      if (url.endsWith("/v2/account")) {
        return response(200, {
          cash: "1000",
          buying_power: "2000",
          equity: "1500",
          portfolio_value: "1500",
          currency: "USD",
          status: "ACTIVE",
        });
      }
      return response(200, []);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "connected_readonly");
  assert.equal(result.runtime.credentialSource, "encrypted_tenant_store");
  assert.equal(result.runtime.secretsRedacted, true);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.options.method, "GET");
    assert.equal(call.options.headers["APCA-API-KEY-ID"], "encrypted-key");
    assert.equal(call.options.headers["APCA-API-SECRET-KEY"], "encrypted-secret");
  }
  assert.equal(JSON.stringify(result).includes("encrypted-secret"), false);
});

test("readonly fetch remains disconnected when encrypted credential resolver fails closed", async () => {
  let contacted = false;
  const result = await fetchAlpacaPaperAccountReadonly({
    env: {},
    credentialResolver() {
      return {
        readyForReadonlyBrokerRead: false,
        env: {},
      };
    },
    async fetchImpl() {
      contacted = true;
      return response(200, {});
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "not_connected_readonly");
  assert.equal(result.runtime.credentialSource, "runtime_env");
  assert.equal(contacted, false);
});
