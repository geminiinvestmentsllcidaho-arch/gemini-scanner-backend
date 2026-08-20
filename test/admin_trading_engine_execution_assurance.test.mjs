import test from "node:test";
import assert from "node:assert/strict";
import { collectAdminTradingEngine, renderAdminTradingEngine } from "../src/scanner/admin_trading_engine.mjs";
test("Admin trading engine reflects readiness and execution assurance without execution controls", () => {
  const model=collectAdminTradingEngine({automaticPaper:{continuity:{enabled:true},enter:{enabled:true},scale:{enabled:true,scaleInEnabled:true,scaleOutEnabled:true},exit:{enabled:true,running:true},readiness:{status:"READY",infrastructureReady:true,blockers:[]},assurance:{report:{healthy:true},safeRepairAllowed:true,safeRepairEligible:false,incident:null},degradedBroker:{degraded:false},lifecycle:{state:"ROUND_TRIP_COMPLETED",selectedSymbol:"USAS"},safety:{paperOnly:true}}});
  const html=renderAdminTradingEngine(model);
  assert.match(html,/Execution Readiness &amp; Assurance/);
  assert.match(html,/Infrastructure readiness <strong>READY<\/strong>/);
  assert.match(html,/Execution assurance <strong>HEALTHY<\/strong>/);
  assert.match(html,/Safe repair authorization <strong>AUTHORIZED<\/strong>/);
  assert.match(html,/Degraded broker <strong>CLEAR<\/strong>/);
  assert.doesNotMatch(html,/submitPaperOrder|cancelOrder|replaceOrder|\.runOnce\(|\/v2\/orders/);
  assert.equal(model.orderPlacementAllowed,false);
  assert.equal(model.accountMutationAllowed,false);
});
