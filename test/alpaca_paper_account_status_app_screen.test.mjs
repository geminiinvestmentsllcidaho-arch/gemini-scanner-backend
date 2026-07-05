import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAlpacaPaperAccountStatusAppScreen, renderAlpacaPaperAccountStatusAppScreenHtml } from "../src/scanner/alpaca_paper_account_status_app_screen.mjs";

test("alpaca paper account app screen reports connected read-only state without secrets", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "alpaca-account-"));
  const accountFile = path.join(dir, "account.json");
  fs.writeFileSync(accountFile, JSON.stringify({ status: "ACTIVE", trading_blocked: false, account_blocked: false, crypto_status: "ACTIVE", options_approved_level: 3 }));
  const screen = buildAlpacaPaperAccountStatusAppScreen({
    accountFile,
    env: {
      ALPACA_KEY: "SECRET_KEY_ID",
      ALPACA_SECRET: "SECRET_VALUE",
      APCA_API_BASE_URL: "https://paper-api.alpaca.markets",
      ALPACA_PAPER_TRADING: "true"
    }
  });

  assert.equal(screen.connected, true);
  assert.equal(screen.noSecretsExposed, true);
  assert.equal(screen.safety.orderPlacement, false);
  assert.equal(screen.safety.brokerExecution, false);

  const html = renderAlpacaPaperAccountStatusAppScreenHtml(screen);
  assert.match(html, /Alpaca Paper Account Status/);
  assert.doesNotMatch(html, /SECRET_KEY_ID|SECRET_VALUE/);
  assert.doesNotMatch(html, /<form|<button|type="submit"/i);
});
