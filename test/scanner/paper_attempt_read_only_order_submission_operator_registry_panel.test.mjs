import test from "node:test";
import assert from "node:assert/strict";
import { buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel, summarizeCertificationForRegistry } from "../../src/scanner/paper_attempt_read_only_order_submission_operator_registry_panel.mjs";

test("operator registry panel is read-only no-go", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel();

  assert.equal(p.ok, true);
  assert.equal(p.version, "paper_attempt_read_only_order_submission_operator_registry_panel_v1");
  assert.equal(p.panelType, "operator_dashboard_card");
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.readOnly, true);
  assert.equal(p.registryOnly, true);
  assert.equal(p.noExecutionControls, true);
  assert.equal(p.brokerContactAllowed, false);
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.liveTradingAllowed, false);
  assert.equal(p.autoTradingAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
  assert.equal(p.registry.registeredNoGo, true);
  assert.equal(p.registry.orderPlacementRegistered, false);
  assert.equal(p.registry.noExecutableOrder, true);
  assert.equal(p.registry.noBrokerContact, true);
  assert.equal(p.registry.certificationCertifiedNoGo, true);
});

test("operator registry panel blocks incomplete certification source safely", () => {
  const p = buildPaperAttemptReadOnlyOrderSubmissionOperatorRegistryPanel({
    certificationSource: {
      version: "unsafe_source",
      finalDecision: "GO",
      readyForOrderPlacement: true,
      readOnly: false,
      certification: {
        certifiedNoGo: false,
        orderPlacementCertified: true,
        noExecutableOrder: false,
        noBrokerContact: false,
        noBrokerOrderPlacement: false
      }
    }
  });

  assert.equal(p.ok, true);
  assert.equal(p.finalDecision, "NO_GO_FOR_ORDER_PLACEMENT");
  assert.equal(p.readyForOrderPlacement, false);
  assert.equal(p.registry.registeredNoGo, false);
  assert.equal(p.registry.orderPlacementRegistered, false);
  assert.equal(p.operatorChainStatus, "registry_blocked_source_incomplete_no_go");
  assert.equal(p.brokerOrderPlacementAllowed, false);
  assert.equal(p.accountMutationAllowed, false);
});

test("summarizeCertificationForRegistry supplies safe defaults", () => {
  const s = summarizeCertificationForRegistry(null);

  assert.equal(s.sourceVersion, null);
  assert.equal(s.sourceReadyForOrderPlacement, false);
  assert.equal(s.sourceReadOnly, false);
  assert.equal(s.certifiedNoGo, false);
  assert.equal(s.orderPlacementCertified, false);
  assert.equal(s.noExecutableOrder, false);
  assert.equal(s.noBrokerContact, false);
});
