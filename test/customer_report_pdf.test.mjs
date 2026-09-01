import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomerReportPdf } from "../src/scanner/customer_report_pdf.mjs";

test("builds a human-readable read-only report PDF with portfolio pricing", () => {
  const pdf = buildCustomerReportPdf({
    period: "daily",
    generatedAt: "2026-08-03T06:00:00.000Z",
    report: {
      status: "stale_readonly",
      stale: true,
      performance: {
        endingBalance: 1001.1,
        realizedPl: 1.25,
        unrealizedPl: -0.15,
        totalPl: 1.1,
        totalReturnPct: 0.11,
      },
      currentBrokerPositions: [{
        symbol: "TEST",
        qty: 20,
        averageEntryPrice: 4.96,
        currentPrice: 4.91,
        marketValue: 98.2,
        unrealizedPl: -1,
      }],
      trades: { completedRoundTrips: 2 },
      scanner: { signalsGenerated: 12 },
    },
  });

  const content = pdf.buffer.toString();
  assert.equal(pdf.filename, "GeminiScanner-Daily-Report.pdf");
  assert.equal(pdf.buffer.subarray(0, 8).toString(), "%PDF-1.4");
  assert.match(content, /Data status: Delayed - latest read-only data may be older than expected/);
  assert.match(content, /Current account equity: \$1,001\.10/);
  assert.match(content, /Combined P\/L: \$1\.10/);
  assert.match(content, /TEST - 20 shares/);
  assert.match(content, /Average entry: \$4\.96/);
  assert.match(content, /Current price: \$4\.91/);
  assert.doesNotMatch(content, /stale_readonly|current_readonly|Paper records/i);
});
