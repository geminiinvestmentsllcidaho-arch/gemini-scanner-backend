import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("confirmed customer-facing typography regressions remain repaired", () => {
  const security = read("src/scanner/customer_security_activity_page.mjs");
  const decisions = read("src/scanner/customer_zero_decision_cards.mjs");
  const underFive = read("src/scanner/customer_zero_under_five_dashboard.mjs");
  const monday = read("src/scanner/customer_stage1_monday_checklist_panel.mjs");

  assert.doesNotMatch(security, /\} \| \$\{/);
  assert.match(security, /\} · \$\{/);

  assert.doesNotMatch(decisions, /Quantity: .* \| Confirmation required:/);
  assert.match(decisions, /Quantity: .* · Confirmation required:/);

  assert.doesNotMatch(underFive, /under-\$5/);
  assert.match(underFive, /stocks under \$5/);

  assert.doesNotMatch(monday, /HARD STOP — DO not place the paper order/);
  assert.match(monday, /HARD STOP — Do not place the paper order/);
});
