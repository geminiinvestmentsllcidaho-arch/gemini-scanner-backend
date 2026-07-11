export const VERSION = "customer_zero_under_five_symbol_detail_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function decisionLabel(value) {
  return String(value ?? "DO_NOT_ENTER").replaceAll("_", " ");
}

export function buildCustomerZeroUnderFiveSymbolDetail(candidate = {}, options = {}) {
  const routeBase = String(options.routeBase ?? "/customer-zero/under-five-scanner").replace(/\/$/, "");
  const role = String(options.role ?? "customer");
  const roleLabel = String(options.roleLabel ?? "Customer");
  const tenant = String(options.tenant ?? "customer");
  const flags = list(candidate.readonlyPotentialFlags);
  const blockers = list(candidate.blockingFlags);
  return {
    version: VERSION,
    route: candidate.symbol
      ? `${routeBase}/${encodeURIComponent(String(candidate.symbol).toUpperCase())}`
      : null,
    backHref: routeBase,
    role,
    roleLabel,
    tenant,
    title: `${candidate.symbol ?? "Unknown"} — Under $5 Scan Detail`,
    symbol: candidate.symbol ?? null,
    name: candidate.name ?? null,
    decision: candidate.decision ?? "DO_NOT_ENTER",
    decisionLabel: decisionLabel(candidate.decision),
    briefExplanation: candidate.briefExplanation ?? "Decision detail is unavailable.",
    score: candidate.readonlyPotentialScore ?? null,
    potentialLabel: candidate.readonlyPotentialLabel ?? "low_priority",
    price: candidate.price ?? null,
    previousClose: candidate.previousClose ?? null,
    changePct: candidate.changePct ?? null,
    spreadPct: candidate.spreadPct ?? null,
    dailyVolume: candidate.dailyVolume ?? null,
    dollarVolume: candidate.dollarVolume ?? null,
    sourceTs: candidate.sourceTs ?? null,
    sourceAgeSec: candidate.sourceAgeSec ?? null,
    sourceStale: candidate.sourceStale === true,
    flags,
    blockers,
    passedChecks: [
      candidate.sourceStale !== true ? "Freshness check passed" : null,
      Number(candidate.spreadPct) <= 1 ? "Spread check passed" : null,
      Number(candidate.dollarVolume) >= 1000000 ? "Liquidity check passed" : null,
      Number(candidate.changePct) > 0 ? "Momentum check passed" : null,
      Number(candidate.readonlyPotentialScore) >= 70 ? "Score threshold passed" : null,
    ].filter(Boolean),
    readOnly: true,
    decisionAssistOnly: true,
    noExecutionControls: true,
    buyRecommendation: false,
    orderPlacementAllowed: false,
    accountMutationAllowed: false,
  };
}

export function renderCustomerZeroUnderFiveSymbolDetailHtml(detail = {}) {
  const passed = list(detail.passedChecks).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>None</li>";
  const flags = list(detail.flags).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>None</li>";
  const blockers = list(detail.blockers).map((item) => `<li>${esc(item)}</li>`).join("") || "<li>None</li>";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(detail.title)}</title>
<style>
body{margin:0;padding:16px;background:#f5f5f5;color:#111;font-family:system-ui}.wrap{max-width:760px;margin:auto}.card{background:#fff;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:#fff}.decision{display:inline-block;padding:10px 14px;border-radius:999px;font-weight:800}.enter{background:#dff7e7;color:#11652e}.wait{background:#fff2c8;color:#765800}.do-not-enter{background:#ffe0e0;color:#8a1111}a{color:#124ea3;font-weight:700}
</style></head><body><main class="wrap" data-role="${esc(detail.role ?? "customer")}" data-tenant="${esc(detail.tenant ?? "customer")}">
<section class="card hero"><p><a href="${esc(detail.backHref ?? "/customer/scanner/under-five")}" style="color:white">← Back to scanner</a></p><h1>${esc(detail.title)}</h1><p><b>Role:</b> ${esc(detail.roleLabel ?? "Customer")}</p></section>
<section class="card"><span class="decision ${esc(String(detail.decision).toLowerCase().replaceAll("_","-"))}">${esc(detail.decisionLabel)}</span><p>${esc(detail.briefExplanation)}</p></section>
<section class="card"><h2>Scan results</h2>
<p><b>Score:</b> ${esc(detail.score)} | <b>Potential:</b> ${esc(detail.potentialLabel)}</p>
<p><b>Price:</b> ${esc(detail.price)} | <b>Previous close:</b> ${esc(detail.previousClose)} | <b>Change:</b> ${esc(detail.changePct)}%</p>
<p><b>Spread:</b> ${esc(detail.spreadPct)}% | <b>Daily volume:</b> ${esc(detail.dailyVolume)} | <b>Dollar volume:</b> ${esc(detail.dollarVolume)}</p>
<p><b>Source age:</b> ${esc(detail.sourceAgeSec)}s | <b>Stale:</b> ${esc(detail.sourceStale)}</p></section>
<section class="card"><h2>Checks passed</h2><ul>${passed}</ul></section>
<section class="card"><h2>Flags</h2><ul>${flags}</ul><h2>Blocking reasons</h2><ul>${blockers}</ul></section>
<section class="card"><b>Decision assist only:</b> ${esc(detail.decisionAssistOnly)}<br><b>Buy recommendation:</b> ${esc(detail.buyRecommendation)}<br><b>No execution controls:</b> ${esc(detail.noExecutionControls)}</section>
</main></body></html>`;
}
