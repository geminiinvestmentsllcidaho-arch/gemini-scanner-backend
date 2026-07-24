import {
  renderBackgroundLogoLayer,
  renderGlobalFooter,
  renderGlobalHeader,
  renderGlobalThemeCss,
} from "./global_theme.mjs";

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
  const fields = source.fields
    .map(
      (field) =>
        `<label>${esc(field.label)}<input name="${esc(field.name)}" type="${esc(field.type)}" autocomplete="${esc(field.autocomplete)}" required></label>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(source.title)}</title>
${renderGlobalThemeCss({ surface: "public" })}
<style>
.auth-wrap{max-width:620px;margin:0 auto;padding:54px 22px 72px}
.auth-card{padding:28px}
h1{font-size:clamp(32px,6vw,48px);letter-spacing:-.035em;margin:0 0 12px}
p{color:var(--gs-muted);line-height:1.6}
form{display:grid;gap:16px;margin-top:26px}
label{display:grid;gap:8px;font-weight:750}
.button-wrap{display:block}
.button-wrap button{width:100%;padding:14px 18px}
.note{font-size:14px;border:1px solid rgba(255,184,77,.48);background:rgba(83,52,5,.34);padding:13px;border-radius:11px}
.links{margin-top:20px}
.terms{display:flex;align-items:flex-start;gap:10px}
.terms input{width:auto;margin-top:4px}
</style>
</head>
<body data-gs-page="customer-signup">
${renderBackgroundLogoLayer()}
${renderGlobalHeader({ surface: "public", homeHref: "/", label: "GeminiScanner" })}
<main class="auth-wrap">
<section class="card auth-card">
<h1>${esc(source.title)}</h1>
<p>${esc(source.subtitle)}</p>
<form method="post" action="${esc(source.submitHref)}">
${fields}
<label class="terms"><input name="termsAccepted" type="checkbox" required><span>I agree to the Terms of Service and Privacy Policy.</span></label>
<span class="button-wrap">${source.accountCreationEnabled ? `<button type="submit">Create account</button>` : `<button type="submit" disabled>Create account</button>`}</span>
</form>
<p class="note">${esc(source.securityNote)}</p>
<p class="links">Already have an account? <a href="${esc(source.signInHref)}">Sign in</a></p>
</section>
</main>
${renderGlobalFooter()}
<script src="/assets/password-visibility.js" defer></script>
</body>
</html>`;
}

export default { VERSION, buildCustomerSignupPage, renderCustomerSignupPageHtml };
