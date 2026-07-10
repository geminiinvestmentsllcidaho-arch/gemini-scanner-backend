const VERSION = "alpaca_operator_key_entry_block_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function present(value) {
  return String(value ?? "").trim().length > 0;
}

export function getAlpacaOperatorKeyEntryBlockDiagnostics({ env = process.env } = {}) {
  const fields = [
    {
      id: "ALPACA_PAPER_TRADING_BASE_URL",
      label: "Alpaca Paper Trading Base URL",
      required: true,
      secret: false,
      present: present(env.ALPACA_PAPER_TRADING_BASE_URL ?? env.APCA_API_BASE_URL),
      example: "https://paper-api.alpaca.markets",
    },
    {
      id: "ALPACA_PAPER_TRADE_API_PATH",
      label: "Alpaca Paper Trade API Path",
      required: true,
      secret: false,
      present: present(env.ALPACA_PAPER_TRADE_API_PATH),
      example: "/v2/paper-trade-path",
    },
    {
      id: "ALPACA_API_KEY_ID",
      label: "Alpaca API Key ID",
      required: true,
      secret: true,
      present: present(env.ALPACA_API_KEY_ID ?? env.ALPACA_KEY_ID ?? env.APCA_API_KEY_ID ?? env.ALPACA_KEY),
      example: "redacted",
    },
    {
      id: "ALPACA_API_SECRET_KEY",
      label: "Alpaca API Secret Key",
      required: true,
      secret: true,
      present: present(env.ALPACA_API_SECRET_KEY ?? env.ALPACA_SECRET_KEY ?? env.APCA_API_SECRET_KEY ?? env.ALPACA_SECRET),
      example: "redacted",
    },
  ];

  const allPresent = fields.every((field) => field.present);

  return {
    ok: true,
    version: VERSION,
    route: "/app/alpaca-operator-key-entry",
    diagnosticRoute: "/diagnostics/alpaca-operator-key-entry",
    title: "Alpaca Operator Key Entry Block",
    displayState: allPresent ? "ALPACA_OPERATOR_KEYS_PRESENT_REDACTED" : "ALPACA_OPERATOR_KEYS_MISSING_OPERATOR_ACTION_REQUIRED",
    status: allPresent ? "keys_present_redacted" : "keys_missing",
    browserEntryBlockAvailable: true,
    clientSideOnly: true,
    serverReceivesSecrets: false,
    saveFromBrowserImplemented: false,
    secretsRedacted: true,
    accountMutationAllowed: false,
    oauthAllowed: false,
    liveTradingAllowed: false,
    autoTradingAllowed: false,
    placementAllowed: false,
    submitAllowed: false,
    brokerContactAllowed: false,
    fields,
    operatorInstructions: [
      "Use this website block to type Alpaca Paper keys locally in the browser.",
      "The form does not submit keys to the server and no save endpoint is implemented.",
      "Use the generated env block only in the VPS runtime environment or a secure secret manager.",
      "Do not paste Alpaca secrets into ChatGPT, Git, docs, screenshots, or command output.",
      "After manually setting VPS env vars, restart PM2 and run runtime preflight and safety validators.",
    ],
    afterManualEnvUpdate: [
      "pm2 restart gemini-scanner --update-env",
      "npm run preflight:paper-broker-runtime-env",
      "npm run validate:trading-safety",
      "npm run validate:connect-safety",
    ],
  };
}

export function renderAlpacaOperatorKeyEntryBlockHtml(input = getAlpacaOperatorKeyEntryBlockDiagnostics()) {
  const rows = input.fields.map((field) => `
    <tr>
      <td><code>${esc(field.id)}</code></td>
      <td>${esc(field.label)}</td>
      <td>${field.required ? "required" : "optional"}</td>
      <td>${field.present ? "present" : "missing"}</td>
      <td>${field.secret ? "redacted" : esc(field.example)}</td>
    </tr>`).join("");

  const instructions = input.operatorInstructions.map((item) => `<li>${esc(item)}</li>`).join("");
  const commands = input.afterManualEnvUpdate.map((item) => `<li><code>${esc(item)}</code></li>`).join("");

  return `<!doctype html>
<html><head><title>${esc(input.title)}</title>
<style>
body{font-family:system-ui,Arial,sans-serif;margin:24px;line-height:1.45}
label{display:block;margin:12px 0 4px;font-weight:700}
input{width:100%;max-width:760px;padding:8px}
textarea{width:100%;max-width:900px;height:170px}
table{border-collapse:collapse;width:100%;margin:16px 0}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background:#f7f7f7}
.lock{background:#fff6e5;border:1px solid #f1d49b;padding:12px;margin:12px 0}
.safe{background:#ecfff0;border:1px solid #a8d8af;padding:12px;margin:12px 0}
code{background:#f4f4f4;padding:2px 4px;border-radius:4px}
button{padding:8px 12px;margin-top:12px}
</style></head>
<body><main><h1>${esc(input.title)}</h1>
<p><strong>Display state:</strong> ${esc(input.displayState)}</p>
<div class="lock"><strong>Safety lock:</strong> Client-side entry only. This page does not submit, store, echo, test, or transmit secrets. OAuth, account mutation, live trading, auto trading, broker contact, placement, and submission remain blocked.</div>
<h2>Local browser entry block</h2>
<label for="baseUrl">ALPACA_PAPER_TRADING_BASE_URL</label><input id="baseUrl" value="https://paper-api.alpaca.markets" autocomplete="off" spellcheck="false">
<label for="orderPath">ALPACA_PAPER_TRADE_API_PATH</label><input id="orderPath" value="/v2/paper-trade-path" autocomplete="off" spellcheck="false">
<label for="keyId">ALPACA_API_KEY_ID</label><input id="keyId" type="password" autocomplete="off" spellcheck="false">
<label for="secretKey">ALPACA_API_SECRET_KEY</label><input id="secretKey" type="password" autocomplete="off" spellcheck="false">
<br><button type="button" onclick="buildEnv()">Build local env block</button>
<p><strong>Generated locally in this browser only:</strong></p><textarea id="envOut" readonly></textarea>
<h2>Runtime presence status</h2><table><tr><th>Env var</th><th>Label</th><th>Required</th><th>Runtime status</th><th>Display</th></tr>${rows}</table>
<h2>Operator instructions</h2><ul>${instructions}</ul>
<h2>After manual VPS env update</h2><ul>${commands}</ul>
<div class="safe"><a href="/diagnostics/alpaca-operator-key-entry">JSON diagnostics</a> · <a href="/app/paper-broker-runtime-environment-preflight">Runtime preflight</a> · <a href="/app">App home</a></div>
<pre>${esc(JSON.stringify(input, null, 2))}</pre></main>
<script>
function q(id){return document.getElementById(id).value.trim();}
function buildEnv(){
  const lines=[
    "ALPACA_PAPER_TRADING_BASE_URL="+q("baseUrl"),
    "ALPACA_PAPER_TRADE_API_PATH="+q("orderPath"),
    "ALPACA_API_KEY_ID="+q("keyId"),
    "ALPACA_API_SECRET_KEY="+q("secretKey")
  ];
  document.getElementById("envOut").value=lines.join("\\n");
}
</script>
</body></html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(getAlpacaOperatorKeyEntryBlockDiagnostics(), null, 2));
}
