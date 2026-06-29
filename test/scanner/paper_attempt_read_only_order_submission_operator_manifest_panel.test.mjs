import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel, summarizeRegistryForManifest } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_manifest_panel.mjs";

test("operator manifest panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_manifest_panel_v1");
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.manifestOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.manifest.manifestedNoGo, true);
  assert.equal(p.manifest.orderPlacementManifested, false);
  assert.equal(p.manifest.noExecutableOrder, true);
  assert.equal(p.manifest.noBrokerContact, true);
  assert.equal(p.manifest.registryRegisteredNoGo, true);
});

test("operator manifest panel blocks incomplete registry source safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorManifestPanel({
    registrySource: {
      version: "unsafe_source",
      finalDecision: "GO",
      readyForOrderPlacement: true,
      readOnly: false,
      registry: {
        registeredNoGo: false,
        orderPlacementRegistered: true,
        noExecutableOrder: false,
        noBrokerContact: false,
        noBrokerOrderPlacement: false
      }
    }
  });

  assert.equal(p.ok, true);
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.manifest.manifestedNoGo, false);
  assert.equal(p.manifest.orderPlacementManifested, false);
  assert.equal(p.operatorChainStatus, "manifest_blocked_source_incomplete_no_go");
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
});

test("summarizeRegistryForManifest supplies safe defaults", () => {
  const s = summarizeRegistryForManifest(null);

  assert.equal(s.sourceVersion, null);
  assert.equal(s.sourceReadyForOrderPlacement, false);
  assert.equal(s.sourceReadOnly, false);
  assert.equal(s.registeredNoGo, false);
  assert.equal(s.orderPlacementRegistered, false);
  assert.equal(s.noExecutableOrder, false);
  assert.equal(s.noBrokerContact, false);
});
