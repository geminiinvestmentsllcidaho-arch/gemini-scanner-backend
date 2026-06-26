import http from "node:http";

function getJson(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port: 3000, path, timeout: 10000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try { resolve({ statusCode: res.statusCode, json: JSON.parse(body) }); }
        catch { reject(new Error(`Invalid JSON from ${path}: ${body.slice(0, 250)}`)); }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout from ${path}`)));
    req.on("error", reject);
  });
}

const res = await getJson("/diagnostics/alpaca-requests");
const audit = res.json?.alpacaRequestAudit || {};
const recent = Array.isArray(audit.recent) ? audit.recent : [];

const checks = {
  "route reachable": res.statusCode === 200,
  "response ok": res.json?.ok === true,
  "audit installed": audit.installed === true,
  "recent array present": Array.isArray(audit.recent),
  "no secret headers exposed": recent.every((e) =>
    !Object.keys(e.headers || {}).some((k) =>
      k.toLowerCase().includes("key") ||
      k.toLowerCase().includes("secret") ||
      k.toLowerCase().includes("authorization")
    )
  ),
};

const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

console.log(JSON.stringify({
  ok: failed.length === 0,
  audit: {
    installed: audit.installed,
    total: audit.total,
    recentCount: recent.length,
    latest: recent[0] ? {
      ts: recent[0].ts,
      ok: recent[0].ok,
      host: recent[0].host,
      path: recent[0].path,
      status: recent[0].status,
      requestId: recent[0].requestId,
    } : null,
  },
  checks,
  failed,
}, null, 2));

if (failed.length) process.exit(1);
