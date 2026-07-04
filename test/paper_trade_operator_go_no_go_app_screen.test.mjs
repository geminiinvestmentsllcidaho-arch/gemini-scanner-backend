import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaperTradeOperatorGoNoGoAppScreen,
  renderPaperTradeOperatorGoNoGoAppScreenHtml
} from "../src/scanner/paper_trade_operator_go_no_go_app_screen.mjs";

test("paper trade operator go/no-go app screen stays read-only and final no-go", () => {
  const screen = buildPaperTradeOperatorGoNoGoAppScreen({
    panel: {
      version: "paper_trade_operator_go_no_go_panel_v1",
      status: "no_go",
      severity: "blocked",
      summary: {
        localSimulationGo: false,
        brokerIntegrationGo: false,
        paperTradingLiveGo: false,
        finalGo: false,
        readinessPct: 0.6,
        nextRequiredOperatorAction: "Review local paper lifecycle results before broker approval."
      },
      gates: {
        localLifecycleReady: false,
        brokerExecutionBlocked: true,
        paperTradingLiveReady: false,
        brokerAdapterEnabled: false,
        brokerContactAllowed: false,
        orderPlacementAllowed: false,
        accountMutationAllowed: false
      },
      reasons: [
        "local_lifecycle_not_complete",
        "broker_adapter_approval_required"
      ],
      badges: [{
        label: "Final Go", value: false
      }],
      safety: {
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        brokerContact: false,
        orderPlacement: false,
        accountMutation: false,
        localJsonlOnly: true
      }
    }
  });

  assert.equal(screen.version, "paper_trade_operator_go_no_go_app_screen_v1");
  assert.equal(screen.route, "/app/paper-trade-operator-go-no-go");
  assert.equal(screen.readOnly, true);
  assert.equal(screen.noExecutionControls, true);
  assert.equal(screen.finalGo, false);
  assert.equal(screen.brokerIntegrationGo, false);
  assert.equal(screen.paperTradingLiveGo, false);
  assert.equal(screen.gates.orderPlacementAllowed, false);
  assert.equal(screen.safety.brokerContact, false);
  assert.equal(screen.links.diagnosticHref, "/diagnostics/paper-trade-operator-go-no-go");
});

test("paper trade operator go/no-go app html has no mutation controls", () => {
  const screen = buildPaperTradeOperatorGoNoGoAppScreen({
    panel: {
      status: "no_go",
      summary: { finalGo: false },
      safety: {
        liveTrading: false,
        autoTrading: false,
        brokerExecution: false,
        brokerContact: false,
        orderPlacement: false,
        accountMutation: false,
        localJsonlOnly: true
      }
    }
  });
  const html = renderPaperTradeOperatorGoNoGoAppScreenHtml(screen);

  assert.match(html, /Paper Trade Operator Go \/ No-Go/);
  assert.match(html, /No broker contact, no order placement, no account mutation/);
  assert.match(html, /Final go: false/);
  assert.doesNotMatch(html, /<form\b/i);
  assert.doesNotMatch(html, /<button\b/i);
  assert.doesNotMatch(html, /type=["']submit["']/i);
});
