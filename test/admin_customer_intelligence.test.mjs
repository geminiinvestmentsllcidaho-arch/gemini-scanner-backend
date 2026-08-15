import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminCustomerIntelligence, renderAdminCustomerIntelligence } from "../src/scanner/admin_customer_intelligence.mjs";

test("builds pure read-only Admin customer intelligence", () => {
  const x = buildAdminCustomerIntelligence({
    generatedAt: "2026-08-15T20:00:00.000Z",
    customerContext: { accountId:"customer-zero", watchlistSymbols:["AAPL","MSFT"] },
    scannerSource: {
      status:"connected_readonly",
      candidates:[
        {symbol:"ABC",resultState:"ENTER",price:4.25,readonlyPotentialScore:91,sourceAgeSec:5,sourceStale:false},
        {symbol:"OLD",resultState:"STALE_DATA",sourceStale:true,staleReasons:["RANKINGS_STALE"],blockingFlags:["wide_spread"]},
      ],
    },
  });
  assert.equal(x.route,"/admin/customer-intelligence");
  assert.equal(x.role,"admin");
  assert.equal(x.scanner.candidateCount,2);
  assert.equal(x.scanner.counts.ENTER,1);
  assert.equal(x.scanner.counts.STALE_DATA,1);
  assert.deepEqual(x.customerContext.watchlistSymbols,["AAPL","MSFT"]);
  assert.equal(x.safety.readOnly,true);
  assert.equal(x.safety.paperOnly,true);
  assert.equal(x.safety.brokerContactAllowed,false);
  assert.equal(x.safety.cacheRefreshAllowed,false);
  assert.equal(x.safety.runnerInvocationAllowed,false);
  assert.equal(x.safety.orderPlacementAllowed,false);
  assert.equal(x.safety.accountMutationAllowed,false);
  assert.equal(x.safety.liveTradingAllowed,false);
});

test("renders Admin customer intelligence with no execution controls", () => {
  const html = renderAdminCustomerIntelligence(buildAdminCustomerIntelligence({
    scannerSource:{status:"connected_readonly",candidates:[{symbol:"ABC",resultState:"ENTER",price:4.25,readonlyPotentialScore:91,sourceAgeSec:5,sourceStale:false}]},
    premarket:{schedulerState:"sleeping",running:true,scanCount:12,lastCandidateCount:3},
    performance:{status:"current_readonly",realizedPl:1.09,unrealizedPl:2,netAfterCosts:3.05},
  }));
  for (const text of ["Customer Intelligence","Scanner intelligence","Freshness","Premarket","Performance","ABC","ENTER"]) assert.match(html,new RegExp(text));
  assert.match(html,/Broker contact: <strong>NONE<\/strong>/);
  assert.match(html,/Admin execution controls: <strong>NONE<\/strong>/);
  assert.doesNotMatch(html,/submitPaperOrder|cancelOrder|replaceOrder|\/v2\/orders|XMLHttpRequest|\bfetch\s*\(/);
  assert.doesNotMatch(html,/type="submit"|method="post"/i);
});
