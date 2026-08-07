import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { auditCustomerPresentation } from "../src/scanner/customer_presentation_qa.mjs";

test("customer presentation QA flags raw customer-facing presentation values", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-presentation-qa-"));
  const file = path.join(dir, "customer_example.mjs");
  fs.writeFileSync(file, `
    export function render() {
      return \`<h1>Preferences</h1>
      <p>Theme: dark</p>
      <p>Locale: en-US</p>
      <p>Status: sourceIntentReplayAudit</p>
      <p>Risk—review</p>\`;
    }
  `);

  const report = auditCustomerPresentation({ rootDir: dir });
  assert.equal(report.readOnly, true);
  assert.ok(report.issueCount >= 4);
  assert.ok(report.issues.some((item) => item.type === "raw_display_preference"));
  assert.ok(report.issues.some((item) => item.type === "raw_locale_or_timezone"));
  assert.ok(report.issues.some((item) => item.type === "raw_camel_case"));
  assert.ok(report.issues.some((item) => item.type === "tight_dash"));
});

test("customer presentation QA ignores ordinary implementation syntax outside visible fragments", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-presentation-qa-"));
  const file = path.join(dir, "customer_example.mjs");
  fs.writeFileSync(file, `
    const internal_value = "sourceIntentReplayAudit";
    export function render() {
      return \`<h1>Preferences</h1><p>Theme: Dark</p><p>Locale: English (United States)</p>\`;
    }
  `);

  const report = auditCustomerPresentation({ rootDir: dir });
  assert.equal(report.issueCount, 0);
});
