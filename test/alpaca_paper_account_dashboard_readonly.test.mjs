import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAlpacaPaperAccountDashboardReadonly,
} from "../src/scanner/alpaca_paper_account_dashboard_readonly.mjs";

test("dashboard uses safe runtime metadata from encrypted fetch result", () => {
  const panel = buildAlpacaPaperAccountDashboardReadonly({
    connected: true,
    networkReadImplemented: true,
    env: {},
    account: { cash: 100, buyingPower: 200 },
    positions: [{ symbol: "AAPL", qty: 1 }],
    fetchResult: {
      ok: true,
      status: "connected_readonly",
      displayState: "ALPACA_PAPER_ACCOUNT_READONLY_CONNECTED",
      runtime: {
        baseUrlPresent: true,
        apiKeyPresent: true,
        apiSecretPresent: true,
        hasRuntimeKeys: true,
        credentialSource: "encrypted_tenant_store",
        baseUrlHost: "paper-api.alpaca.markets",
        paperOnly: true,
        readOnly: true,
        allowedMethods: ["GET"],
        secretsRedacted: true,
      },
    },
  });

  assert.equal(panel.status, "connected_readonly");
  assert.equal(panel.hasRuntimeKeys, true);
  assert.equal(panel.runtime.credentialSource, "encrypted_tenant_store");
  assert.equal(panel.runtime.baseUrlHost, "paper-api.alpaca.markets");
  assert.equal(panel.runtime.paperOnly, true);
  assert.equal(panel.runtime.readOnly, true);
  assert.deepEqual(panel.runtime.allowedMethods, ["GET"]);
  assert.equal(panel.runtime.secretsRedacted, true);
  assert.equal(panel.summary.positionsCount, 1);
  assert.equal(panel.placementAllowed, false);
  assert.equal(panel.submitAllowed, false);
  assert.equal(panel.cancelAllowed, false);
});
