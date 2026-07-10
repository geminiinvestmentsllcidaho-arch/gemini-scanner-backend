export const VERSION = "public_homepage_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildPublicHomepage() {
  return Object.freeze({
    version: VERSION,
    route: "/",
    product: "GeminiScanner",
    headline: "Decision-assist stock scanning built for clear, disciplined market review.",
    description:
      "GeminiScanner organizes stock opportunities into focused scanner views, watchlists, and read-only decision support.",
    capabilities: Object.freeze([
      "Intraday stock scanner",
      "Under $5 stock scanner",
      "Shared market snapshots",
      "Watchlist and display settings",
    ]),
    futurePlans: Object.freeze([
      "Swing and long-term scanner modes",
      "Separate ETF scanner universe",
      "Separate crypto scanner universe",
      "Options scanner support",
    ]),
    signInHref: "/customer",
    readOnly: true,
    decisionAssistOnly: true,
  });
}

export function renderPublicHomepageHtml(source = buildPublicHomepage()) {
  const capabilities = source.capabilities
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");
  const futurePlans = source.futurePlans
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(source.product)}</title>
<style>
body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#070b12;color:#eef4ff}
main{max-width:1040px;margin:auto;padding:28px 18px 48px}.brand{font-weight:850;letter-spacing:.04em;color:#b9c8ff}
.hero{padding:52px 0 30px}h1{font-size:clamp(36px,7vw,68px);line-height:1.02;margin:14px 0}
.lead{max-width:780px;color:#c7d2e4;font-size:20px;line-height:1.55}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
.card{background:#0d1520;border:1px solid #243044;border-radius:18px;padding:22px}h2{margin-top:0}
ul{padding-left:20px;line-height:1.8;color:#d7e2f2}.cta{display:inline-block;margin-top:18px;padding:13px 18px;border-radius:12px;background:#dce7ff;color:#07101c;text-decoration:none;font-weight:800}
.note{margin-top:24px;color:#8fa0b7}@media(max-width:760px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<main>
<div class="brand">◇ ${esc(source.product)}</div>
<section class="hero">
<h1>${esc(source.headline)}</h1>
<p class="lead">${esc(source.description)}</p>
<a class="cta" href="${esc(source.signInHref)}">Sign in</a>
</section>
<section class="grid">
<div class="card"><h2>Scanner capabilities</h2><ul>${capabilities}</ul></div>
<div class="card"><h2>Coming next</h2><ul>${futurePlans}</ul></div>
</section>
<p class="note">Decision assist only. Read-only market intelligence. No automatic execution.</p>
</main>
</body>
</html>`;
}

export default {
  VERSION,
  buildPublicHomepage,
  renderPublicHomepageHtml,
};
