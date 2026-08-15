import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  buildAdminSurface,
  renderAdminSurfaceHtml,
} from "../src/scanner/admin_surface.mjs";

test("builds isolated read-only admin surface", () => {
  const surface = buildAdminSurface({
    alpacaAccess: {
      enabled: false,
      accessMode: "ALPACA_ACCOUNT_ACCESS_OFF",
      readAccessAllowed: false,
      credentialResolutionAllowed: false,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
    },
  });

  assert.equal(surface.route, "/admin");
  assert.equal(surface.role, "admin");
  assert.equal(surface.readOnly, true);
  assert.equal(surface.decisionAssistOnly, false);
  assert.equal(surface.orderPlacementAllowed, false);
  assert.equal(surface.accountMutationAllowed, false);
  assert.deepEqual(
    surface.navigation.map((item) => item.href),
    [
      "/admin",
      "/admin/system-health",
      "/admin/trading-engine",
      "/admin/customer-intelligence",
      "/admin/security",
    ]
  );
});

test("renders admin-only navigation without customer interface links", () => {
  const html = renderAdminSurfaceHtml(buildAdminSurface({
    alpacaAccess: {
      enabled: true,
      accessMode: "ALPACA_ACCOUNT_ACCESS_ON",
      readAccessAllowed: true,
      credentialResolutionAllowed: true,
      brokerMutationAllowed: false,
      orderPlacementAllowed: false,
      orderCancellationAllowed: false,
      liveTradingAllowed: false,
      paperTradingSubmissionAllowed: false,
      reason: "test",
      updatedBy: "admin",
      updatedAt: "2026-08-07T23:30:00.000Z",
    },
  }));

  assert.match(html, /data-role="admin"/);
  assert.match(html, /Protected admin operations/);
  assert.match(html, /Admin is read-only/);
  assert.match(html, /Alpaca account access/);
  assert.match(html, /Status: <strong>ON<\/strong>/);
  assert.match(html, /form method="post" action="\/admin\/alpaca-access"/);
  assert.match(html, /form method="post" action="\/admin\/logout"/);
  assert.match(html, /<button type="submit">Log out<\/button>/);
  assert.match(html, /background:#000/);
  assert.match(html, /color:#39ff14/);
  assert.match(html, /border:1px solid #39ff14/);
  assert.match(html, /button\{background:#000;color:#00ffff;border:1px solid #00ffff/);
  assert.match(html, /nav button\{border:1px solid #00ffff;background:#000;color:#00ffff/);
  assert.doesNotMatch(html, /#b8c7dc|#0b1220|#101827|#1b263b|#38bdf8/i);
  for (const label of [
    "System &amp; Infrastructure Health",
    "Server Status Panel",
    "Uptime &amp; Latency Monitor",
    "Error Log Stream",
    "Trading Engine &amp; Execution",
    "Automatic Alpaca PAPER Execution",
    "Brokerage API Status",
    "Execution Latency Panel",
    "Financial &amp; Risk Management",
    "Portfolio &amp; Liquidity Dashboard",
    "Kill Switch Control",
    "P&amp;L Tracker",
    "Security &amp; User Activity",
    "Security &amp; Failed Logins",
    "Active User Sessions",
    "Database &amp; Queue Backups",
  ]) assert.match(html, new RegExp(label));
  assert.match(html, /Memory:<\/strong>/);
  assert.match(html, /\/health:<\/strong>/);
  assert.match(html, /Recent errors:<\/strong>/);
  assert.match(html, /Exact concurrent-session counting not yet instrumented/);
  assert.match(html, /Automatic backup scheduler verification pending/);
  assert.match(html, /ENTER:<\/strong>/);
  assert.match(html, /Last stored HTTP:<\/strong>/);
  assert.match(html, /Submit → fill:<\/strong>/);
  assert.match(html, /Automatic Alpaca PAPER Execution[\s\S]*Open trading engine/);
  assert.doesNotMatch(html, /Open brokerage status/);
  assert.doesNotMatch(html, /Open latency detail/);
  assert.equal((html.match(/href="\/admin\/trading-engine"/g) || []).length, 2);
  assert.match(html, /Brokerage API Status[\s\S]*Included in Trading Engine &amp; Execution\./);
  assert.match(html, /Execution Latency Panel[\s\S]*Included in Trading Engine &amp; Execution\./);
  assert.match(html, /Turn OFF Alpaca read access/);
  assert.match(html, /Automatic Alpaca PAPER execution runs independently/i);
  assert.doesNotMatch(html, /href="\/customer(?:["/])/);
  assert.doesNotMatch(html, /\/customer-zero\b/);
  assert.doesNotMatch(html, /\bDELETE\b|XMLHttpRequest|\bfetch\s*\(/);
});


test("admin layout uses responsive full-width viewport rules for portrait and landscape", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  assert.match(server, /Admin responsive viewport repair/);
  assert.match(server, /width:\s*min\(100%,\s*1600px\)/);
  assert.match(server, /padding-inline:\s*clamp\(14px,\s*2\.5vw,\s*36px\)/);
  assert.match(server, /@media\s*\(max-width:\s*900px\)/);
  assert.match(server, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*700px\)\s*and\s*\(min-width:\s*600px\)/);
  assert.match(server, /overflow-x:\s*hidden/);
  assert.match(server, /overflow-x:\s*auto/);
});


test("dead Admin destinations stay non-clickable and valid links render as cyan actions", () => {
  const html = renderAdminSurfaceHtml(buildAdminSurface({}));
  assert.doesNotMatch(html, /href="\/admin\/(?:scanners|shared-cache|customers)"/);
  assert.match(html, /class="admin-action" href="\/admin\/system-health"/);
  assert.doesNotMatch(html, /Open error stream/);
  assert.match(html, /Included in System &amp; Infrastructure Health\./);
  assert.match(html, /class="admin-action" href="\/admin\/trading-engine"/);
  assert.match(html, /class="admin-action" href="\/admin\/security"/);
  assert.match(html, /background:#00ffff|background:\s*#00ffff/);
});


test("Admin overview links to protected customer intelligence without adding execution controls", () => {
  const html = renderAdminSurfaceHtml(buildAdminSurface({}));
  assert.match(html, /Customer Intelligence/);
  assert.match(html, /class="admin-action" href="\/admin\/customer-intelligence"/);
  assert.match(html, /Open customer intelligence/);
  assert.match(html, /No broker contact, cache refresh, runner invocation, or execution controls/);
  assert.doesNotMatch(html, /submitPaperOrder|cancelOrder|replaceOrder|XMLHttpRequest|\bfetch\s*\(/);
});

test("automatic PAPER overview renders runtime state without execution controls", () => {
  const html = renderAdminSurfaceHtml(buildAdminSurface({ tradingEngine: { automaticPaper: { enter:{enabled:true}, scale:{enabled:true,scaleInEnabled:true,scaleOutEnabled:true}, exit:{enabled:true,running:true}, lifecycle:{state:"MONITORING",selectedSymbol:"USAS"} } } }));
  assert.match(html,/Automatic Alpaca PAPER Execution/);
  assert.match(html,/ENTER:<\/strong> ARMED/);
  assert.match(html,/SCALE:<\/strong> ARMED/);
  assert.match(html,/EXIT:<\/strong> ARMED/);
  assert.match(html,/MONITORING/);
  assert.match(html,/USAS/);
  assert.match(html,/Admin is read-only/);
  assert.doesNotMatch(html,/submitPaperOrder|cancelOrder|replaceOrder|XMLHttpRequest|\bfetch\s*\(/);
});
