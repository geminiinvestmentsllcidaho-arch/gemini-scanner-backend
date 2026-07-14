import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";

export const VERSION = "public_homepage_v2";

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
    eyebrow: "Market intelligence for disciplined traders",
    headline: "Find stronger stock setups. Review them with clarity.",
    description:
      "GeminiScanner turns live market data into focused scanner views, ranked opportunities, watchlists, and read-only decision support.",
    capabilities: Object.freeze([
      Object.freeze({
        title: "Focused scanners",
        text: "Review intraday and under-$5 opportunities without sorting through market noise.",
      }),
      Object.freeze({
        title: "Clear decision support",
        text: "See ranked setups, confidence context, and readable explanations.",
      }),
      Object.freeze({
        title: "Built-in discipline",
        text: "Read-only workflows keep analysis separate from order execution.",
      }),
    ]),
    futurePlans: Object.freeze([
      "Swing and long-term scanner modes",
      "Separate ETF and crypto scanner universes",
      "Options scanner support",
    ]),
    signInHref: "/customer",
    signupHref: "/signup",
    scannerHref: "/customer/scanner",
    readOnly: true,
    decisionAssistOnly: true,
  });
}

export function renderPublicHomepageHtml(source = buildPublicHomepage()) {
  const capabilities = source.capabilities
    .map(
      (item) =>
        `<article class="card"><span class="mark">◆</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`,
    )
    .join("");
  const futurePlans = source.futurePlans
    .map((item) => `<li>${esc(item)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(source.description)}">
<title>${esc(source.product)} — Stock scanner and decision support</title>
${renderGlobalThemeCss({ surface: "public" })}
<style>
:root{color-scheme:dark;--bg:#070b12;--panel:#0e1623;--line:#26364d;--text:#f4f7fb;--muted:#a8b6ca;--accent:#8aa4ff;--soft:#dbe4ff}
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:radial-gradient(circle at top right,#14213a 0,#070b12 42%);color:var(--text)}
a{color:inherit}.wrap{max-width:1120px;margin:auto;padding:0 22px}.topbar-actions{display:flex;gap:16px;align-items:center;justify-content:flex-end;padding:18px 0}
.nav-link{color:var(--muted);text-decoration:none;font-weight:750}.nav-link:hover{color:var(--text)}
.hero{padding:70px 0 50px;display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:46px;align-items:center}
.eyebrow{color:var(--accent);text-transform:uppercase;letter-spacing:.13em;font-size:12px;font-weight:900}
h1{font-size:clamp(42px,7vw,76px);line-height:.99;letter-spacing:-.045em;margin:18px 0 22px;max-width:830px}
.lead{font-size:clamp(18px,2vw,22px);line-height:1.62;color:var(--muted);max-width:760px;margin:0}
.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}.btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 19px;border-radius:12px;text-decoration:none;font-weight:850;border:1px solid var(--line)}
.btn-primary{background:var(--soft);color:#09111e;border-color:transparent}.btn-secondary{background:#0b1220}.btn:hover{transform:translateY(-1px)}
.preview{background:linear-gradient(180deg,#111d2d,var(--panel));border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 24px 80px #0008}
.preview-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.status{font-size:12px;font-weight:900;color:#9fe0b1;background:#11281a;border:1px solid #245b35;padding:7px 10px;border-radius:999px}
.metric{display:flex;justify-content:space-between;padding:15px 0;border-top:1px solid #213047}.metric:first-of-type{border-top:0}.metric span{color:var(--muted)}.metric strong{font-size:20px}
.section{padding:36px 0 58px}.section h2{font-size:clamp(29px,4vw,43px);letter-spacing:-.03em;margin:0 0 12px}.section-copy{color:var(--muted);max-width:700px;line-height:1.65;margin:0 0 26px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#0d1521;border:1px solid var(--line);border-radius:18px;padding:22px}.mark{color:var(--accent)}.card h3{margin:16px 0 8px;font-size:20px}.card p{margin:0;color:var(--muted);line-height:1.62}
.next{background:#0d1521;border:1px solid var(--line);border-radius:20px;padding:28px}.next ul{margin:18px 0 0;padding-left:20px;color:var(--muted);line-height:1.9}
footer{border-top:1px solid #1b283a;margin-top:24px;padding:26px 0 38px;color:#7f8da3;font-size:14px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:820px){.hero{grid-template-columns:1fr;padding-top:46px}.cards{grid-template-columns:1fr}.preview{max-width:560px}}
</style>
</head>
<body data-gs-page="public-homepage">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "public", homeHref: "/", label: source.product })}
<div class="wrap">
<div class="topbar-actions" aria-label="Public account navigation"><a class="nav-link" href="${esc(source.signupHref)}">Sign up</a><a class="nav-link" href="${esc(source.signInHref)}">Sign in</a></div>
<main>
<section class="hero">
<div>
<p class="eyebrow">${esc(source.eyebrow)}</p>
<h1>${esc(source.headline)}</h1>
<p class="lead">${esc(source.description)}</p>
<div class="actions">
<a class="btn btn-primary" href="${esc(source.signupHref)}">Create account</a>
<a class="btn btn-secondary" href="${esc(source.scannerHref)}">View scanner</a>
</div>
</div>
<aside class="preview" aria-label="Product summary">
<div class="preview-top"><strong>Scanner overview</strong><span class="status">READ ONLY</span></div>
<div class="metric"><span>Intraday scanner</span><strong>Live</strong></div>
<div class="metric"><span>Under-$5 scanner</span><strong>Live</strong></div>
<div class="metric"><span>Decision support</span><strong>Active</strong></div>
</aside>
</section>
<section class="section">
<h2>Scanner capabilities</h2>
<p class="section-copy">Built to reduce noise—not add to it.</p>
<div class="cards">${capabilities}</div>
</section>
<section class="section">
<div class="next">
<h2>Coming next</h2>
<ul>${futurePlans}</ul>
</div>
</section>
</main>
<footer>
<span>Decision assist only. No automatic execution.</span>
<span>© ${new Date().getUTCFullYear()} ${esc(source.product)}</span>
</footer>
</div>
${renderGlobalFooter()}
</body>
</html>`;
}

export default {
  VERSION,
  buildPublicHomepage,
  renderPublicHomepageHtml,
};
