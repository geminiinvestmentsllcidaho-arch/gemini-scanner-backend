const VERSION = "alpaca_paper_account_dashboard_readonly_v1";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function num(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function present(value) {
  return String(value ?? "").trim().length > 0;
}
function runtime(env = process.env) {
  return {
    baseUrlPresent: present(env.ALPACA_PAPER_TRADING_BASE_URL ?? env.APCA_API_BASE_URL),
    apiKeyPresent: present(env.ALPACA_API_KEY_ID ?? env.ALPACA_KEY_ID ?? env.APCA_API_KEY_ID ?? env.ALPACA_KEY),
    apiSecretPresent: present(env.ALPACA_API_SECRET_KEY ?? env.ALPACA_SECRET_KEY ?? env.APCA_API_SECRET_KEY ?? env.ALPACA_SECRET),
  };
}
function money(value, currency = "USD") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}
function pct(value) {
  if (value === null || value === undefined) return "—";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

export function buildAlpacaPaperAccountDashboardReadonly(input = {}) {
  const r = runtime(input.env ?? process.env);
  const account = input.account ?? {};
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const connected = Boolean(input.connected);
  const networkReadImplemented = Boolean(input.networkReadImplemented);
  const safePositions = positions.map((p) => ({
    symbol: String(p.symbol ?? ""),
    qty: num(p.qty),
    avgEntryPrice: num(p.avgEntryPrice ?? p.avg_entry_price),
    currentPrice: num(p.currentPrice ?? p.current_price),
    marketValue: num(p.marketValue ?? p.market_value),
    unrealizedPl: num(p.unrealizedPl ?? p.unrealized_pl),
    unrealizedPlpc: num(p.unrealizedPlpc ?? p.unrealized_plpc),
  }));
  return {
    ok: true,
    version: VERSION,
    route: "/app/alpaca-paper-account-dashboard",
    diagnosticRoute: "/diagnostics/alpaca-paper-account-dashboard",
    title: "Alpaca Paper Account Dashboard",
    displayState: connected ? "ALPACA_PAPER_ACCOUNT_READONLY_CONNECTED" : "ALPACA_PAPER_ACCOUNT_READONLY_NOT_CONNECTED",
    status: connected ? "connected_readonly" : "not_connected_readonly",
    mode: "PAPER_ONLY",
    readOnly: true,
    secretsRedacted: true,
    networkReadImplemented,
    brokerReadAllowed: networkReadImplemented,
    accountMutationAllowed: false,
    oauthAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    placementAllowed: false,
    submitAllowed: false,
    cancelAllowed: false,
    runtime: r,
    hasRuntimeKeys: r.baseUrlPresent && r.apiKeyPresent && r.apiSecretPresent,
    account: {
      cash: num(account.cash),
      buyingPower: num(account.buyingPower ?? account.buying_power),
      equity: num(account.equity),
      portfolioValue: num(account.portfolioValue ?? account.portfolio_value),
      currency: String(account.currency ?? "USD"),
      accountStatus: String(account.status ?? (connected ? "connected" : "unknown")),
    },
    positions: safePositions,
    summary: {
      positionsCount: safePositions.length,
      totalMarketValue: safePositions.reduce((sum, p) => sum + (p.marketValue ?? 0), 0),
      totalUnrealizedPl: safePositions.reduce((sum, p) => sum + (p.unrealizedPl ?? 0), 0),
      operatorMessage: networkReadImplemented
        ? "Read-only paper account network read is enabled. No account mutation, live trading, auto trading, placement, submit, or cancel controls are exposed."
        : "Dashboard shell is ready. Network read is not enabled yet, so live Alpaca paper balances and positions are not fetched by this panel.",
    },
  };
}

export function renderAlpacaPaperAccountDashboardReadonlyHtml(panel = buildAlpacaPaperAccountDashboardReadonly()) {
  const c = panel.account.currency || "USD";
  const rows = panel.positions.map((p) => `<tr><td>${esc(p.symbol)}</td><td>${p.qty ?? "—"}</td><td>${money(p.avgEntryPrice, c)}</td><td>${money(p.currentPrice, c)}</td><td>${money(p.marketValue, c)}</td><td>${money(p.unrealizedPl, c)}</td><td>${pct(p.unrealizedPlpc)}</td></tr>`).join("");
  return `<!doctype html><html><head><title>${esc(panel.title)}</title><style>
body{font-family:system-ui,Arial,sans-serif;margin:24px;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0}.card{border:1px solid #ddd;border-radius:10px;padding:14px}.card b{display:block;font-size:13px;color:#555}.card span{font-size:22px;font-weight:700}.lock{background:#fff6e5;border:1px solid #f1d49b;padding:12px;border-radius:10px;margin:12px 0}.safe{background:#ecfff0;border:1px solid #a8d8af;padding:12px;border-radius:10px;margin:12px 0}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f7f7f7}code{background:#f4f4f4;padding:2px 4px;border-radius:4px}
</style></head><body><main><h1>${esc(panel.title)}</h1><p><strong>Display state:</strong> ${esc(panel.displayState)}</p><div class="lock"><strong>Safety:</strong> READ ONLY · PAPER ONLY · NO LIVE TRADING · NO AUTO TRADING · NO PLACEMENT · NO SUBMIT · NO CANCEL · NO ACCOUNT MUTATION</div><div class="grid"><div class="card"><b>Connection</b><span>${panel.networkReadImplemented ? (panel.status === "connected_readonly" ? "Connected" : "Not connected") : "Shell only"}</span></div><div class="card"><b>Buying Power</b><span>${money(panel.account.buyingPower, c)}</span></div><div class="card"><b>Cash</b><span>${money(panel.account.cash, c)}</span></div><div class="card"><b>Portfolio Value</b><span>${money(panel.account.portfolioValue, c)}</span></div><div class="card"><b>Equity</b><span>${money(panel.account.equity, c)}</span></div><div class="card"><b>Positions</b><span>${panel.summary.positionsCount}</span></div></div><h2>Positions</h2><table><tr><th>Symbol</th><th>Qty</th><th>Avg Entry</th><th>Current</th><th>Market Value</th><th>Unrealized P/L</th><th>P/L %</th></tr>${rows || '<tr><td colspan="7">No positions loaded.</td></tr>'}</table><div class="safe">${esc(panel.summary.operatorMessage)}</div><p><a href="/app/alpaca-operator-key-entry">Alpaca key entry block</a> · <a href="/diagnostics/alpaca-paper-account-dashboard">JSON diagnostics</a> · <a href="/app">App home</a></p><pre>${esc(JSON.stringify(panel, null, 2))}</pre></main></body></html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(buildAlpacaPaperAccountDashboardReadonly(), null, 2));
}
