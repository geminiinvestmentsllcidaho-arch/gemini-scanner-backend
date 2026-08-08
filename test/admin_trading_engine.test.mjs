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
