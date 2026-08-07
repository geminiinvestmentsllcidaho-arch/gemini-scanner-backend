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


test("customer presentation QA ignores nested template implementation syntax and numeric ranges", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-presentation-qa-"));
  const file = path.join(dir, "customer_example.mjs");
  fs.writeFileSync(file, `
    export function render(proposal, realtimeAiReview) {
      return \`<h1>Report</h1>
      <p>Status: \${esc(({ completed_readonly: "Review complete" })[realtimeAiReview.status] ?? "Not active")}</p>
      <p>\${esc(({ data_quality: "Data freshness" })[proposal?.category] ?? "Review item")} · \${esc(proposal?.severity ?? "Informational")}</p>
      <p>Available funds: 5% (0–80%, 5% steps)</p>\`;
    }
  `);

  const report = auditCustomerPresentation({ rootDir: dir });
  assert.equal(report.issueCount, 0);
});


test("customer presentation QA ignores SVG path implementation markup", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-presentation-qa-"));
  const file = path.join(dir, "customer_example.mjs");
  fs.writeFileSync(file, `
    export function render() {
      const icons = {
        "current-broker-holdings": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h14.5a2 2 0 0 1 2 2"/></svg>',
        "realtime-ai-review": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12h2l1-3 2 6"/></svg>',
      };
      return \`<h1>Reports</h1><p>Friendly customer copy.</p>\`;
    }
  `);

  const report = auditCustomerPresentation({ rootDir: dir });
  assert.equal(report.issueCount, 0);
});
