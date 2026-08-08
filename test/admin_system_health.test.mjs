import assert from "node:assert/strict";
import test from "node:test";

import {
  collectAdminSystemHealth,
  renderAdminSystemHealth,
} from "../src/scanner/admin_system_health.mjs";

test("admin system health is local read only", async () => {
  const x = await collectAdminSystemHealth();
  assert.equal(x.readOnly, true);
  assert.equal(x.brokerContactAllowed, false);
  assert.equal(x.orderPlacementAllowed, false);
  assert.equal(x.accountMutationAllowed, false);
  assert.ok(x.host);
  assert.ok(x.latency);
});

test("renders system panels", () => {
  const h = renderAdminSystemHealth({
    generatedAt: "x",
    host: {
      uptimeSec: 123,
      memoryPct: 50,
      diskPct: 20,
      load: 0.1,
      rx: 1,
      tx: 2,
    },
    latency: {
      health: { code: 200, ms: 1 },
      readiness: { code: 200, ms: 2 },
    },
    processes: [],
    errors: [],
    infra: "healthy",
    ops: "healthy",
  });

  assert.match(h, /Server Status Panel/);
  assert.match(h, /Uptime &amp; Latency Monitor/);
  assert.match(h, /Error Log Stream/);
  assert.match(h, /background:#000/);
  assert.match(h, /#39ff14/);
  assert.match(h, /#00ffff/);
});
