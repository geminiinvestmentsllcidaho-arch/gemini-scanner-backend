import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildAdminCompanionStatus } from "../src/scanner/admin_companion_api.mjs";

test("builds a secret-free read-only Admin companion payload", () => {
  const payload = buildAdminCompanionStatus({
    generatedAt: "2026-08-11T01:20:00.000Z",
    systemHealth: {
      host: { uptimeSec: 100, memoryPct: 33.2, diskPct: 44, load: 0.25 },
      latency: { health: { ms: 12 }, readiness: { ms: 18 } },
      processes: [
        { name: "gemini-scanner", status: "online", cpu: 1, mem: 1000 },
        { name: "gemini-dry-scanner", status: "stopped", cpu: 0, mem: 0 },
      ],
      errors: [{ source: "gemini-scanner", line: "example application error" }],
    },
    tradingEngine: {
      orderEvidence: { activeStoredCount: 1, latestStatus: "filled", order: { symbol: "AAPL" } },
      brokerage: { alpacaReadAccessEnabled: true, lastStoredResponseStatus: 200 },
      execution: { submitToFillMs: 42 },
    },
    infrastructureIncident: { open: false, reportStatus: "healthy", failureCodes: [] },
    opsAiIncident: { open: false, reportStatus: "healthy", failureCodes: [] },
  });

  assert.equal(payload.status, "ok");
  assert.equal(payload.readOnly, true);
  assert.equal(payload.adminOnly, true);
  assert.equal(payload.trading.activeStoredOrders, 1);
  assert.equal(payload.trading.latestOrderSymbol, "AAPL");
  assert.equal(payload.trading.alpacaReadAccessEnabled, true);
  assert.equal(payload.capabilities.brokerContactAllowed, false);
  assert.equal(payload.capabilities.orderPlacementAllowed, false);
  assert.equal(payload.capabilities.liveTradingAllowed, false);
  assert.equal(JSON.stringify(payload).includes("API_KEY"), false);
  assert.equal(JSON.stringify(payload).includes("SECRET"), false);
});

test("marks companion status degraded for open incidents", () => {
  const payload = buildAdminCompanionStatus({
    systemHealth: { processes: [{ name: "gemini-scanner", status: "online" }] },
    infrastructureIncident: {
      open: true,
      reportStatus: "unhealthy",
      transition: "failure_opened",
      failureCodes: ["HEALTH_DEGRADED"],
    },
  });
  assert.equal(payload.status, "degraded");
  assert.equal(payload.incidents.infrastructure.open, true);
  assert.deepEqual(payload.incidents.infrastructure.failureCodes, ["HEALTH_DEGRADED"]);
});

test("server exposes companion status only behind existing Admin authorization", () => {
  const server = fs.readFileSync("src/server.js", "utf8");
  assert.match(server, /app\.get\('\/admin\/api\/companion\/status', requireAdminAuthorization/);
  assert.match(server, /buildAdminCompanionStatus/);
  assert.match(server, /Cache-Control', 'no-store'/);
  const start = server.indexOf("app.get('/admin/api/companion/status'");
  const end = server.indexOf("\n});", start);
  const route = server.slice(start, end + 4);
  assert.doesNotMatch(route, /fetch\(['"]https:\/\/paper-api\.alpaca\.markets|submitOrder|cancelOrder|deleteOrder/i);
});
