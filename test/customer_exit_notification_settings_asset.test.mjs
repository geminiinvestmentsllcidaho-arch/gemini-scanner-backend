import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../public/assets/customer-exit-notification-settings.js", import.meta.url), "utf8");
test("tests EXIT notification channels locally without trading actions", () => {
  assert.match(source, /GeminiScanner EXIT notification test/);
  assert.match(source, /TEST ONLY/);
  assert.match(source, /No trading action or evidence change occurred/);
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|placeOrder|cancelOrder|submit\(/);
});
