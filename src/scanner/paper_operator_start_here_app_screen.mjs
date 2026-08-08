const ROUTES = Object.freeze([
  ["/app/paper-trading-overview-status", "Paper Trading Overview Status"],
  ["/app/paper-app-route-health-status", "Paper App Route Health Status"],
  ["/app/paper-app-safety-lock-status", "Paper App Safety Lock Status"],
  ["/app/paper-app-readiness-status", "Paper App Readiness Status"],
  ["/app/paper-readiness-gate", "Paper Trading Readiness Gate"],
  ["/app/paper-trading-module-final-status", "Paper Trading Module Final Status"],
  ["/app/paper-app-broker-readiness-index", "Paper App Broker Readiness Index"],
  ["/app/paper-broker-runtime-environment-preflight", "Paper Broker Runtime Environment Preflight"],
]);

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function buildPaperOperatorStartHereAppScreen() {
  return {
    ok: true,
    version: "paper_operator_start_here_app_screen_v1",
    route: "/app/paper-operator-start-here",
    title: "Paper Operator Start Here",
    displayState: "PAPER_OPERATOR_START_HERE_READONLY",
    finalDecision: "NO_GO_FOR_ORDER_PLACEMENT",
    monitorOnly: true,
    diagnosticsOnly: true,
    readOnly: true,
    noExecutionControls: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    recommendedSequence: ROUTES.map(([href, title], index) => ({ step: index + 1, href, title })),
  };
}

export function renderPaperOperatorStartHereAppScreenHtml(screen = buildPaperOperatorStartHereAppScreen()) {
  const rows = screen.recommendedSequence.map((route) => `<li><a href="${esc(route.href)}">${esc(route.title)}</a></li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(screen.title)}</title></head><body><main><p><a href="/app">App</a></p><h1>${esc(screen.title)}</h1><p>${esc(screen.finalDecision)}</p><p>read-only. Monitor-only. Diagnostics-only. No broker contact. No order placement. No account mutation. No live trading. No auto trading. No execution controls.</p><h2>Start Here Sequence</h2><ol>${rows}</ol><h2>Safety Locks</h2><p>brokerContactAllowed=false</p><p>orderPlacementAllowed=false</p><p>accountMutationAllowed=false</p></main></body></html>`;
}
