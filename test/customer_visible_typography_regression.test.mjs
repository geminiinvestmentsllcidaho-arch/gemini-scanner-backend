import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("confirmed customer-facing typography regressions remain repaired", () => {
  const security = read("src/scanner/customer_security_activity_page.mjs");
  const underFive = read("src/scanner/customer_zero_under_five_dashboard.mjs");

  assert.doesNotMatch(security, /\} \| \$\{/);
  assert.match(security, /\} · \$\{/);


  assert.doesNotMatch(underFive, /under-\$5/);
  assert.match(underFive, /stocks under \$5/);

});
