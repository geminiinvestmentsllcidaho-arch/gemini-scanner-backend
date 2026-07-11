export const VERSION = "customer_signup_page_v1";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCustomerSignupPage(options = {}) {
  return Object.freeze({
    version: VERSION,
    route: "/signup",
    title: "Create your GeminiScanner account",
    subtitle: "Start with a secure customer account. Email verification and authenticator setup follow after registration.",
    fields: Object.freeze([
      Object.freeze({ name: "firstName", label: "First name", type: "text", autocomplete: "given-name" }),
      Object.freeze({ name: "lastName", label: "Last name", type: "text", autocomplete: "family-name" }),
      Object.freeze({ name: "email", label: "Email address", type: "email", autocomplete: "email" }),
      Object.freeze({ name: "password", label: "Password", type: "password", autocomplete: "new-password" }),
      Object.freeze({ name: "confirmPassword", label: "Confirm password", type: "password", autocomplete: "new-password" }),
    ]),
    signInHref: "/customer",
    submitHref: "/signup",
    minimumPasswordLength: 12,
    accountCreationEnabled: options.accountCreationEnabled === true,
    securityNote: options.securityNote ?? "Registration is controlled by a server-side safety gate.",
  });
}

export function renderCustomerSignupPageHtml(source = buildCustomerSignupPage()) {
  const fields = source.fields.map((field) => `<label>${esc(field.label)}<input name="${esc(field.name)}" type="${esc(field.type)}" autocomplete="${esc(field.autocomplete)}" required></label>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(source.title)}</title><style>
:root{color-scheme:dark;--bg:#070b12;--panel:#0e1623;--line:#26364d;--text:#f4f7fb;--muted:#a8b6ca;--accent:#8aa4ff}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Inter,system-ui,sans-serif;background:radial-gradient(circle at top right,#14213a 0,#070b12 45%);color:var(--text)}
main{max-width:620px;margin:0 auto;padding:54px 22px 72px}.card{background:#0d1521;border:1px solid var(--line);border-radius:22px;padding:28px}
h1{font-size:clamp(32px,6vw,48px);letter-spacing:-.035em;margin:0 0 12px}p{color:var(--muted);line-height:1.6}
form{display:grid;gap:16px;margin-top:26px}label{display:grid;gap:8px;font-weight:750}input{width:100%;padding:13px 14px;border-radius:11px;border:1px solid var(--line);background:#080f1a;color:var(--text);font:inherit}
button{padding:14px 18px;border:0;border-radius:11px;background:#dbe4ff;color:#09111e;font-weight:900;font:inherit;cursor:not-allowed;opacity:.65}
.note{font-size:14px;border:1px solid #4a3f1f;background:#211b0d;padding:13px;border-radius:11px}.links{margin-top:20px}.links a{color:var(--accent)}
</style></head><body><main><section class="card"><h1>${esc(source.title)}</h1><p>${esc(source.subtitle)}</p><form method="post" action="${esc(source.submitHref)}">${fields}<label><span><input style="width:auto" name="termsAccepted" type="checkbox" required> I agree to the Terms of Service and Privacy Policy.</span></label><span class="button-wrap">${source.accountCreationEnabled ? `<button type="submit">Create account</button>` : `<button type="submit" disabled>Create account</button>`}</span></form><p class="note">${esc(source.securityNote)}</p><p class="links">Already have an account? <a href="${esc(source.signInHref)}">Sign in</a></p></section></main></body></html>`;
}

export default { VERSION, buildCustomerSignupPage, renderCustomerSignupPageHtml };
