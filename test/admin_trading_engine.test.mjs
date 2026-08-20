import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { collectAdminTradingEngine, renderAdminTradingEngine } from "../src/scanner/admin_trading_engine.mjs";

test("collects trading engine from local stored evidence only", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gs-admin-trading-"));
  fs.writeFileSync(path.join(dir, "paper_order_readonly_status_check_2026-01-01.json"), JSON.stringify({
    alpacaOrderId:"o1", symbol:"SPY", qty:"1", side:"buy", status:"filled",
    filledQty:"1", submittedAt:"2026-01-01T00:00:00.000Z", filledAt:"2026-01-01T00:00:00.920Z",
    brokerReadAttempted:true, brokerContactAttempted:true, responseStatus:200, responseStatusText:"OK"
  }));
  const x = collectAdminTradingEngine({ runsDir:dir, alpacaAccess:{enabled:true,accessMode:"ALPACA_ACCOUNT_ACCESS_ON"} });
  assert.equal(x.readOnly,true);
  assert.equal(x.localEvidenceOnly,true);
  assert.equal(x.brokerContactAllowed,false);
  assert.equal(x.orderPlacementAllowed,false);
  assert.equal(x.accountMutationAllowed,false);
  assert.equal(x.orderEvidence.latestStatus,"filled");
  assert.equal(x.orderEvidence.activeStoredCount,0);
  assert.equal(x.execution.submitToFillMs,920);
  assert.equal(x.brokerage.lastStoredResponseStatus,200);
});

test("renders protected trading engine detail", () => {
  const html = renderAdminTradingEngine(collectAdminTradingEngine({ runsDir:"/definitely/missing", alpacaAccess:{enabled:false} }));
  assert.match(html,/Trading Engine &amp; Execution/);
  assert.match(html,/Active Orders &amp; Queue/);
  assert.match(html,/Brokerage API Status/);
  assert.match(html,/Execution Latency Panel/);
  assert.match(html,/No broker request is made by this page/);
  assert.match(html,/background:#000/);
  assert.match(html,/#39ff14/);
  assert.match(html,/#00ffff/);
});


test("automatic PAPER runner observability is read only", () => {
  const automaticPaper={continuity:{enabled:true,lastStatus:"ACTIVE"},enter:{enabled:true,lastStatus:"READY",lastSizing:{allocationPercent:10,quantity:4}},scale:{enabled:true,scaleInEnabled:true,scaleOutEnabled:true,lastStatus:"MONITORING"},exit:{enabled:true,running:true,lastStatus:"MONITORING"},lifecycle:{state:"MONITORING",selectedSymbol:"USAS",filledQuantity:4,averageFillPrice:4.5,brokerPositionIdentity:"USAS:4"},safety:{paperOnly:true}};
  const x=collectAdminTradingEngine({runsDir:"/definitely/missing",automaticPaper});
  assert.equal(x.automaticPaper.enter.enabled,true);
  assert.equal(x.automaticPaper.scale.scaleInEnabled,true);
  assert.equal(x.automaticPaper.exit.running,true);
  assert.equal(x.automaticPaper.lifecycle.state,"MONITORING");
  assert.equal(x.automaticPaper.safety.liveTradingAllowed,false);
  assert.equal(x.automaticPaper.safety.adminExecutionControls,false);
  const html=renderAdminTradingEngine(x);
  for(const label of ["Automatic Alpaca PAPER Execution","Active PAPER Lifecycle","Automatic Position Sizing","Reconciliation &amp; Protection State"]) assert.match(html,new RegExp(label));
  assert.match(html,/5% \/ 7\.5% \/ 10%/);
  assert.match(html,/does not invoke any runner/);
});


test("Module 13 Admin renders Automatic Entry Validation read-only evidence", () => {
  const automaticPaper={
    continuity:{enabled:true,lastStatus:"ACTIVE"},
    enter:{enabled:true,lastStatus:"READY",lastSizing:{allocationPercent:10,quantity:4}},
    scale:{enabled:true,scaleInEnabled:true,scaleOutEnabled:true},
    exit:{enabled:true,running:true},
    lifecycle:{state:"MONITORING",selectedSymbol:"M13"},
    entryValidation:{
      status:"ENTRY_COMPLETED",
      lastCandidate:{symbol:"M13",decision:"ENTER",blocker:null},
      allocationPercent:10,
      proposedQuantity:4,
      executedQuantity:4,
      lastEntry:{symbol:"M13",brokerOrderId:"paper-order-m13",filledQuantity:4,averageFillPrice:5.25,reconciliationStatus:"RECONCILED_STATE_UPDATED"},
      correlationId:"entry:0123456789abcdef01234567",
    },
    safety:{paperOnly:true},
  };
  const x=collectAdminTradingEngine({runsDir:"/definitely/missing",automaticPaper});
  assert.equal(x.automaticPaper.entryValidation.status,"ENTRY_COMPLETED");
  assert.equal(x.automaticPaper.entryValidation.correlationId,"entry:0123456789abcdef01234567");
  const html=renderAdminTradingEngine(x);
  assert.match(html,/Automatic Entry Validation/);
  assert.match(html,/ENTRY_COMPLETED/);
  assert.match(html,/paper-order-m13/);
  assert.match(html,/entry:0123456789abcdef01234567/);
  assert.match(html,/No controls, broker requests, order actions/);
  assert.equal(x.automaticPaper.safety.liveTradingAllowed,false);
  assert.equal(x.automaticPaper.safety.adminExecutionControls,false);
});
