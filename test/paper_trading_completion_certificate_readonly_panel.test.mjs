import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildPaperTradingCompletionCertificateReadOnlyPanel,
  renderPaperTradingCompletionCertificateReadOnlyPanel
} from "../src/scanner/paper_trading_completion_certificate_readonly_panel.mjs";

function seed(dir) {
  writeFileSync(join(dir, "paper_broker_network_call_post_attempt_2026.json"), JSON.stringify({
    response: {
      bodyPreview: JSON.stringify({
        id: "order-1",
        symbol: "SPY",
        qty: "1",
        side: "buy",
        type: "market",
        time_in_force: "day"
      })
    }
  }));
  writeFileSync(join(dir, "paper_order_readonly_status_check_2026.json"), JSON.stringify({
    brokerReadAttempted: true,
    brokerContactAttempted: true,
    alpacaOrderId: "order-1",
    symbol: "SPY",
    qty: "1",
    side: "buy",
    type: "market",
    timeInForce: "day",
    status: "filled",
    filledQty: "1",
    filledAvgPrice: "749.19"
  }));
}

test("paper trading completion certificate is read-only and complete", () => {
  const dir = mkdtempSync(join(tmpdir(), "paper-completion-cert-"));
  seed(dir);

  const report = buildPaperTradingCompletionCertificateReadOnlyPanel({
    runsDir: dir,
    now: new Date("2026-07-01T22:40:00Z"),
    markPrice: 750.19
  });
  const cert = report.paperTradingCompletionCertificate;

  assert.equal(report.ok, true);
  assert.equal(report.displayState, "PAPER_TRADING_COMPLETION_CERTIFICATE_READY_READONLY");
  assert.equal(cert.certificateReady, true);
  assert.equal(cert.certificateStatus, "paper_trading_completion_certificate_ready_readonly");
  assert.equal(cert.certificateAlgorithm, "sha256");
  assert.match(cert.certificateHash, /^[a-f0-9]{64}$/);
  assert.equal(cert.moduleState, "paper_trading_readonly_module_complete");
  assert.equal(cert.nextAllowedAction, "operator_review_only_no_order_placement");
  assert.equal(cert.orderPlacementAllowed, false);
  assert.equal(cert.brokerContactAllowed, false);
  assert.equal(cert.retryAllowed, false);
  assert.equal(cert.accountMutationAllowed, false);
  assert.equal(cert.safetyLocked, true);
  assert.equal(cert.sourceSealStatus, "paper_lifecycle_operator_handoff_packet_digest_seal_ready_readonly");
  assert.match(cert.sourceSealHash, /^[a-f0-9]{64}$/);
  assert.match(cert.sourceDigest, /^[a-f0-9]{64}$/);
  assert.equal(cert.symbol, "SPY");
  assert.equal(cert.markPrice, "750.19");
  assert.ok(cert.completionScope.includes("paper_operator_handoff_packet_digest_seal"));

  assert.equal(report.readOnly, true);
  assert.equal(report.monitorOnly, true);
  assert.equal(report.diagnosticsOnly, true);
  assert.equal(report.noExecutionControls, true);
  assert.equal(report.brokerReadAttempted, false);
  assert.equal(report.brokerContactAttempted, false);
  assert.equal(report.orderSubmitAttempted, false);
  assert.equal(report.orderSubmitted, false);
  assert.equal(report.accountMutationAttempted, false);

  const html = renderPaperTradingCompletionCertificateReadOnlyPanel(report);
  assert.match(html, /Paper Trading Completion Certificate Read-Only/);
  assert.match(html, /PAPER_TRADING_COMPLETION_CERTIFICATE_READY_READONLY/);
  assert.match(html, /Certificate algorithm: sha256/);
  assert.match(html, /Module state: paper_trading_readonly_module_complete/);
  assert.match(html, /Next allowed action: operator_review_only_no_order_placement/);
  assert.match(html, /Order placement allowed: false/);
  assert.match(html, /Broker contact allowed: false/);
  assert.match(html, /Safety locked: true/);
});
