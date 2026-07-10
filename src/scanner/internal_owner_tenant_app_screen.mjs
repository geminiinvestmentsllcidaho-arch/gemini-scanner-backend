import { buildInternalOwnerTenantReadonly } from "./internal_owner_tenant_readonly.mjs";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function yesNo(value) {
  return value === true ? "yes" : "no";
}

export function buildInternalOwnerTenantAppScreen(options = {}) {
  const source = buildInternalOwnerTenantReadonly(options);
  return {
    ...source,
    version: "internal_owner_tenant_app_screen_v1",
    route: "/app/internal-owner",
    title: "Internal Owner Account",
    headline: `${source.tenant.name} owner foundation`,
    bootstrapNotice: "Bootstrap profile only. Authentication, authorization enforcement, and tenant isolation are not implemented yet.",
    routes: {
      appHomeHref: "/app",
      diagnosticHref: "/diagnostics/internal-owner-tenant-readonly",
    },
  };
}

export function renderInternalOwnerTenantAppScreenHtml(
  screen = buildInternalOwnerTenantAppScreen()
) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(screen.title)}</title>
<style>
body{font-family:system-ui;margin:0;background:#f5f5f5;color:#111;padding:14px}.wrap{max-width:760px;margin:auto}.hero,.card{background:#fff;border-radius:18px;padding:16px;margin:10px 0;box-shadow:0 8px 22px #0001}.hero{background:#111;color:#fff}.warn{border-left:5px solid #111}a{display:inline-block;background:#eee;border-radius:999px;padding:8px 11px;margin:4px;color:#111;text-decoration:none}
</style></head><body><main class="wrap">
<section class="hero"><p><a href="${esc(screen.routes.appHomeHref)}">App Home</a></p><h1>${esc(screen.title)}</h1><p>${esc(screen.headline)}</p><p>${esc(screen.displayState)}</p></section>
<section class="card warn"><h2>Bootstrap Notice</h2><p>${esc(screen.bootstrapNotice)}</p></section>
<section class="card"><h2>Tenant</h2><p><b>Name:</b> ${esc(screen.tenant.name)}</p><p><b>ID:</b> ${esc(screen.tenant.id)}</p><p><b>Type:</b> ${esc(screen.tenant.type)}</p><p><b>Public signup enabled:</b> ${esc(yesNo(screen.tenant.publicRegistrationEnabled))}</p></section>
<section class="card"><h2>Owner</h2><p><b>Display name:</b> ${esc(screen.user.displayName)}</p><p><b>Role:</b> ${esc(screen.user.role)}</p><p><b>App access label:</b> ${esc(yesNo(screen.user.appAccess))}</p><p><b>Admin access label:</b> ${esc(yesNo(screen.user.adminAccess))}</p></section>
<section class="card"><h2>Security Foundation</h2><p><b>Authentication implemented:</b> ${esc(yesNo(screen.access.authenticationImplemented))}</p><p><b>Authorization enforced:</b> ${esc(yesNo(screen.access.authorizationEnforced))}</p><p><b>Tenant isolation implemented:</b> ${esc(yesNo(screen.access.tenantIsolationImplemented))}</p><p><b>Raw secrets exposed:</b> ${esc(yesNo(screen.credentials.rawSecretsExposed))}</p></section>
<section class="card"><h2>Trading Safety</h2><p><b>Read-only:</b> ${esc(yesNo(screen.safety.readOnly))}</p><p><b>Order placement allowed:</b> ${esc(yesNo(screen.safety.orderPlacementAllowed))}</p><p><b>Live trading allowed:</b> ${esc(yesNo(screen.safety.liveTradingAllowed))}</p><p><b>Auto trading allowed:</b> ${esc(yesNo(screen.safety.autoTradingAllowed))}</p></section>
<section class="card"><a href="${esc(screen.routes.diagnosticHref)}">View JSON Diagnostic</a></section>
</main></body></html>`;
}
