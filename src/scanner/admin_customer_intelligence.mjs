export const VERSION = "admin_customer_intelligence_v1";

const list = (v) => Array.isArray(v) ? v : [];
const finite = (v) => Number.isFinite(Number(v)) ? Number(v) : null;
const esc = (v) => String(v ?? "")
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#39;");

export function buildAdminCustomerIntelligence(options = {}) {
  const source = options.scannerSource ?? {};
  const candidates = Object.freeze(list(source.candidates).map((c) => Object.freeze({
    symbol: String(c?.symbol ?? "").trim().toUpperCase() || null,
    state: String(c?.resultState ?? c?.decision ?? "NO_SETUP").trim().toUpperCase(),
    price: finite(c?.price),
    score: finite(c?.readonlyPotentialScore),
    rankingConfidence: finite(c?.rankingConfidence),
    sourceTs: c?.sourceTs ?? null,
    sourceAgeSec: finite(c?.sourceAgeSec),
    sourceStale: c?.sourceStale === true,
    staleReasons: Object.freeze([...list(c?.staleReasons)]),
    blockingFlags: Object.freeze([...list(c?.blockingFlags)]),
  })));

  const counts = {};
  for (const row of candidates) counts[row.state] = (counts[row.state] ?? 0) + 1;

  return Object.freeze({
    version: VERSION,
    route: "/admin/customer-intelligence",
    role: "admin",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    customerContext: Object.freeze({
      accountId: options.customerContext?.accountId ?? null,
      label: options.customerContext?.label ?? "Shared customer intelligence",
      watchlistSymbols: Object.freeze([...list(options.customerContext?.watchlistSymbols)]),
      watchlistUpdatedAt: options.customerContext?.watchlistUpdatedAt ?? null,
    }),
    scanner: Object.freeze({
      sourceStatus: source?.status ?? source?.sourceStatus ?? null,
      marketClock: source?.marketClock ?? null,
      runtimeHealth: source?.runtimeHealth ?? null,
      rankingBridge: source?.rankingBridge ?? null,
      candidateCount: candidates.length,
      counts: Object.freeze({ ...counts }),
      candidates,
    }),
    freshness: options.scannerFreshness ?? null,
    premarket: options.premarket ?? null,
    performance: options.performance ?? null,
    safety: Object.freeze({
      readOnly: true,
      paperOnly: true,
      brokerContactAllowed: false,
      cacheRefreshAllowed: false,
      runnerInvocationAllowed: false,
      adminExecutionControls: false,
      orderPlacementAllowed: false,
      accountMutationAllowed: false,
      lifecycleMutationAllowed: false,
      liveTradingAllowed: false,
    }),
  });
}

const metric = (label, value) =>
  `<div class="m"><span>${esc(label)}</span><strong>${esc(value ?? "Unavailable")}</strong></div>`;

export function renderAdminCustomerIntelligence(model = buildAdminCustomerIntelligence()) {
  const rows = list(model.scanner?.candidates).map((c) =>
    `<tr><td>${esc(c.symbol)}</td><td>${esc(c.state)}</td><td>${esc(c.price ?? "Unavailable")}</td>` +
    `<td>${esc(c.score ?? "Unavailable")}</td><td>${c.sourceStale ? "YES" : "NO"}</td>` +
    `<td>${esc(c.sourceAgeSec ?? "Unavailable")}</td><td>${esc(c.staleReasons.join(", ") || "None")}</td>` +
    `<td>${esc(c.blockingFlags.join(", ") || "None")}</td></tr>`
  ).join("");

  const counts = Object.entries(model.scanner?.counts ?? {})
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([state,count]) => metric(state,count)).join("");

  const f = model.freshness ?? {};
  const p = model.premarket ?? {};
  const perf = model.performance ?? {};
  const watchlist = list(model.customerContext?.watchlistSymbols).join(", ") || "Empty";

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GeminiScanner Admin — Customer Intelligence</title>
<style>html,body{margin:0;background:#000;color:#39ff14;font-family:system-ui}main{width:min(100%,1600px);margin:auto;padding:24px}.p{border:1px solid #39ff14;border-radius:14px;padding:18px;margin:14px 0}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.m{border:1px solid #39ff14;border-radius:9px;padding:10px;display:flex;flex-direction:column}.tw{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:800px}th,td{border:1px solid #39ff14;padding:8px;text-align:left}a{color:#00ffff}</style>
</head><body><main data-role="admin" data-page="customer-intelligence">
<p><a href="/admin">← Admin</a></p>
<section class="p"><h1>Customer Intelligence</h1><p>Read-only operator view of customer-facing intelligence. No broker contact, cache refresh, or execution controls.</p></section>
<section class="p"><h2>Customer context</h2><div class="g">${metric("Context",model.customerContext?.label)}${metric("Account ID",model.customerContext?.accountId)}${metric("Watchlist",watchlist)}${metric("Watchlist updated",model.customerContext?.watchlistUpdatedAt)}</div></section>
<section class="p"><h2>Scanner intelligence</h2><div class="g">${metric("Source status",model.scanner?.sourceStatus)}${metric("Candidates",model.scanner?.candidateCount)}${counts}</div><div class="tw"><table><thead><tr><th>Symbol</th><th>State</th><th>Price</th><th>Score</th><th>Stale</th><th>Age sec</th><th>Stale reasons</th><th>Blocking flags</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No current candidates.</td></tr>'}</tbody></table></div></section>
<section class="p"><h2>Freshness</h2><div class="g">${metric("Quote stale count",f.quoteFreshness?.staleCount)}${metric("Ranking stale",f.rankingFreshness?.stale === true ? "YES" : "NO")}${metric("Stream connected",f.stream?.connected === true ? "YES" : "NO")}${metric("Runtime degraded",f.runtimeHealth?.degraded === true ? "YES" : "NO")}</div></section>
<section class="p"><h2>Premarket</h2><div class="g">${metric("Scheduler",p.schedulerState)}${metric("Running",p.running === true ? "YES" : "NO")}${metric("Scan count",p.scanCount)}${metric("Last candidate count",p.lastCandidateCount)}</div></section>
<section class="p"><h2>Performance</h2><div class="g">${metric("Status",perf.status)}${metric("Realized P/L",perf.realizedPl)}${metric("Unrealized P/L",perf.unrealizedPl)}${metric("Net after costs",perf.netAfterCosts)}</div></section>
<section class="p"><h2>Safety boundary</h2><p>Read-only: <strong>YES</strong> · PAPER-only: <strong>YES</strong> · Broker contact: <strong>NONE</strong> · Cache refresh: <strong>NONE</strong> · Runner invocation: <strong>NONE</strong> · Live trading: <strong>DISABLED</strong> · Admin execution controls: <strong>NONE</strong>.</p></section>
</main></body></html>`;
}

export default { VERSION, buildAdminCustomerIntelligence, renderAdminCustomerIntelligence };
