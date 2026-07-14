import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');
const sameOriginSource = await readFile(new URL('../src/scanner/customer_same_origin.mjs', import.meta.url), 'utf8');

test('customer authentication routes exist', () => {
  assert.match(source, /app\.get\('\/login'/);
  assert.match(source, /app\.post\('\/login'/);
  assert.match(source, /app\.post\('\/logout', requireCustomerSameOrigin/);
});

test('public customer authentication mutations require same-origin verification', () => {
  for (const route of [
    '/signup',
    '/login',
    '/forgot-password',
    '/reset-password',
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.post\\('${escaped}', requireCustomerSameOrigin,`));
  }
});

test('customer routes require signed customer sessions', () => {
  for (const route of [
    '/customer',
    '/customer/scanner',
    '/customer/watchlist',
    '/customer/settings',
    '/customer/scanner/under-five/:symbol',
    '/customer/scanner/under-five',
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp(`app\\.get\\('${escaped}', requireCustomerSession,`));
  }
});

test('verification and duplicate signup send customers to login', () => {
  assert.match(source, /href="\/login">Continue to sign in/);
  assert.match(source, /href="\/login">Sign in/);
});

test('settings page exposes logout form', () => {
  assert.match(source, /form method="post" action="\/logout"/);
  assert.match(source, />Log out<\/button>/);
});

test('customer session cookies use centralized restrictive options', () => {
  assert.match(source, /import \{ buildCustomerSessionCookieOptions, buildCustomerSessionCookieClearOptions \} from '\.\/scanner\/customer_session_cookie\.mjs';/);
  assert.match(source, /res\.cookie\(CUSTOMER_COOKIE_NAME, token, buildCustomerSessionCookieOptions\(\)\);/);
  assert.equal(
    [...source.matchAll(/res\.clearCookie\(CUSTOMER_COOKIE_NAME, buildCustomerSessionCookieClearOptions\(\)\);/g)].length,
    6,
  );
});

test('customer login route rate limits repeated attempts and clears on success', () => {
  assert.match(source, /import \{ createCustomerLoginRateLimiter \} from '\.\/scanner\/customer_login_rate_limit\.mjs';/);
  assert.match(source, /const customerLoginRateLimiter = createCustomerLoginRateLimiter\(\);/);
  assert.match(source, /if \(customerLoginRateLimiter\.isLimited\(req\)\)/);
  assert.match(source, /res\.set\('Retry-After', '900'\)/);
  assert.match(source, /res\.status\(429\)/);
  assert.match(source, /customerLoginRateLimiter\.clear\(req\);/);
});


test('settings page exposes read-only account details', () => {
  for (const label of [
    'Account details',
    'Email',
    'Account status',
    'Email verification',
    'Customer ID',
    'Member since',
  ]) {
    assert.match(source, new RegExp(`>${label}<`));
  }

  assert.match(source, /account\?\.email/);
  assert.match(source, /account\?\.status/);
  assert.match(source, /account\?\.emailVerified/);
  assert.match(source, /account\?\.id/);
  assert.match(source, /account\?\.createdAt/);
  assert.match(source, /Cache-Control', 'no-store'/);
});


test('settings page exposes authenticated email change controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/email"/);
  assert.match(source, /name="newEmail"/);
  assert.match(source, /id="emailChangePassword" name="currentPassword"/);
  assert.match(source, /app\.post\('\/customer\/settings\/email', requireCustomerSession, requireCustomerSameOrigin, async/);
  assert.match(source, /beginCustomerEmailChange\(/);
  assert.match(source, /createCustomerEmailVerification\(/);
  assert.match(source, /appendCustomerEmailVerificationRecord\(/);
  assert.match(source, /deliverCustomerVerificationEmail\(/);
  assert.match(source, /current email remains active until verification succeeds/i);
});

test('settings page exposes authenticated password change controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/password"/);
  assert.match(source, /name="currentPassword"/);
  assert.match(source, /name="newPassword"/);
  assert.match(source, /name="confirmPassword"/);
  assert.match(source, /app\.post\('\/customer\/settings\/password', requireCustomerSession,/);
  assert.match(source, /updateCustomerPassword\(/);
  assert.match(source, /res\.clearCookie\(CUSTOMER_COOKIE_NAME,/);
});

test('settings page exposes authenticated profile update controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/profile"/);
  assert.match(source, /name="firstName"/);
  assert.match(source, /name="lastName"/);
  assert.match(source, /app\.post\('\/customer\/settings\/profile', requireCustomerSession,/);
  assert.match(source, /updateCustomerProfile\(/);
  assert.match(source, /res\.redirect\(303, '\/customer\/settings'\)/);
});

test('settings page exposes authenticated notification preference controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/notifications"/);
  assert.match(source, /name="scannerAlerts"/);
  assert.match(source, /name="accountSecurityEmails" type="checkbox" checked disabled/);
  assert.match(source, /name="productUpdates"/);
  assert.match(source, /app\.post\('\/customer\/settings\/notifications', requireCustomerSession,/);
  assert.match(source, /updateCustomerNotificationPreferences\(/);
  assert.match(source, /res\.redirect\(303, '\/customer\/settings'\)/);
});

test('settings page exposes authenticated display preference controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/display"/);
  assert.match(source, /name="theme"/);
  assert.match(source, /name="density"/);
  assert.match(source, /name="locale"/);
  assert.match(source, /name="timezone"/);
  assert.match(source, /name="reducedMotion"/);
  assert.match(source, /app\.post\('\/customer\/settings\/display', requireCustomerSession,/);
  assert.match(source, /updateCustomerDisplayPreferences\(/);
  assert.match(source, /res\.redirect\(303, '\/customer\/settings'\)/);
});

test('settings page exposes authenticated authenticator setup controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/authenticator\/start"/);
  assert.match(source, /form method="post" action="\/customer\/settings\/authenticator\/confirm"/);
  assert.match(source, /app\.post\('\/customer\/settings\/authenticator\/start', requireCustomerSession/);
  assert.match(source, /app\.post\('\/customer\/settings\/authenticator\/confirm', requireCustomerSession/);
  assert.match(source, /Save your recovery codes/);
  assert.match(source, /These codes are shown only once/);
  assert.match(source, /authenticatorRecoveryCodes/);
  assert.match(source, /Recovery codes remaining:/);
});

test('login submits optional authenticator code for enabled accounts', () => {
  assert.match(source, /name="authenticatorCode"/);
  assert.match(source, /name="authenticatorRecoveryCode"/);
  assert.match(source, /verifyAuthenticatorCode: verifyCustomerAuthenticatorCode/);
  assert.match(source, /consumeAuthenticatorRecoveryCode: consumeCustomerAuthenticatorRecoveryCode/);
  assert.match(source, /result\.reason === 'authenticator_required'/);
});


test('settings page exposes authenticated recovery code regeneration controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/authenticator\/recovery-codes\/regenerate"/);
  assert.match(source, />Generate new recovery codes<\/button>/);
  assert.match(source, /app\.post\('\/customer\/settings\/authenticator\/recovery-codes\/regenerate', requireCustomerSession/);
  assert.match(source, /regenerateCustomerAuthenticatorRecoveryCodes\(/);
  assert.match(source, /Your previous recovery codes are now invalid/);
});


test('settings page exposes authenticated authenticator disable controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/authenticator\/disable"/);
  assert.match(source, /app\.post\('\/customer\/settings\/authenticator\/disable', requireCustomerSession/);
  assert.match(source, /disableCustomerAuthenticator\(/);
});


test('customer password recovery routes are public, rate limited, and token protected', () => {
  assert.match(source, /href="\/forgot-password">Forgot password\?/);
  assert.match(source, /app\.get\('\/forgot-password'/);
  assert.match(source, /app\.post\('\/forgot-password'/);
  assert.match(source, /app\.get\('\/reset-password'/);
  assert.match(source, /app\.post\('\/reset-password'/);
  assert.match(source, /createCustomerPasswordResetRateLimiter/);
  assert.match(source, /customerPasswordResetRateLimiter\.isLimited\(req\)/);
  assert.match(source, /createCustomerPasswordReset\(/);
  assert.match(source, /appendCustomerPasswordResetRecord\(/);
  assert.match(source, /deliverCustomerPasswordResetEmail\(/);
  assert.match(source, /verifyCustomerPasswordResetToken\(/);
  assert.match(source, /resetCustomerPassword\(/);
  assert.match(source, /markCustomerPasswordResetConsumed\(/);
  const forgotPasswordPostRoute = source.match(
    /app\.post\('\/forgot-password',[\s\S]*?\n\}\);\n\napp\.get\('\/reset-password'/,
  )?.[0] ?? '';

  assert.match(forgotPasswordPostRoute, /If that email belongs to an active account/);
  assert.match(forgotPasswordPostRoute, /\[customer-password-reset\] delivery_failed/);
  assert.doesNotMatch(forgotPasswordPostRoute, /Password recovery is temporarily unavailable/);
  assert.doesNotMatch(forgotPasswordPostRoute, /res\.status\(503\)/);
});


test('settings page exposes authenticated customer data export controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/data\/export"/);
  assert.match(source, />Download my data<\/button>/);
  assert.match(source, /app\.post\('\/customer\/settings\/data\/export', requireCustomerSession,/);
  assert.match(source, /buildCustomerDataExport\(req\.customerAccount\.id,/);
  assert.match(source, /Content-Disposition'/);
  assert.match(source, /type\('application\/json'\)/);
});


test('settings page exposes sign out all sessions controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/sessions\/revoke"/);
  assert.match(source, />Sign out all sessions<\/button>/);
  assert.match(source, /app\.post\('\/customer\/settings\/sessions\/revoke', requireCustomerSession,/);
  assert.match(source, /revokeCustomerSessions\(req\.customerAccount\.id\)/);
  assert.match(source, /res\.clearCookie\(CUSTOMER_COOKIE_NAME,/);
  assert.match(source, /res\.redirect\(303, '\/login'\)/);
});


test('settings page exposes last sign-in security activity', () => {
  assert.match(source, /recordCustomerLogin\(/);
  assert.match(source, /ip: req\.ip \|\| req\.socket\?\.remoteAddress/);
  assert.match(source, /userAgent: req\.get\('user-agent'\)/);
  assert.match(source, />Last sign-in<\/div>/);
  assert.match(source, />Last sign-in IP<\/div>/);
  assert.match(source, />Last sign-in device<\/div>/);
  assert.match(source, /<h2>Recent sign-in activity<\/h2>/);
  assert.match(source, /recentLoginHistory/);
  assert.match(source, />Successful sign-ins<\/div>/);
});


test('settings page exposes authenticated permanent account deletion controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/account\/delete"/);
  assert.match(source, /name="currentPassword" type="password"/);
  assert.match(source, /name="confirmPermanentDelete" type="checkbox" required/);
  assert.match(source, />Permanently delete account<\/button>/);
  assert.match(source, /app\.post\('\/customer\/settings\/account\/delete', requireCustomerSession/);
  assert.match(source, /permanentlyDeleteCustomerAccount\(/);
  assert.match(source, /res\.clearCookie\(CUSTOMER_COOKIE_NAME,/);
  assert.match(source, /res\.redirect\(303, '\/'\)/);
});


test('customer settings mutations require same-origin verification', () => {
  assert.match(source, /import \{ requireCustomerSameOrigin \} from '\.\/scanner\/customer_same_origin\.mjs';/);
  assert.match(sameOriginSource, /req\.get\('origin'\)/);
  assert.match(sameOriginSource, /sourceUrl\.protocol !== 'https:'/);
  assert.match(sameOriginSource, /trustedSameSiteMatch/);
  assert.match(source, /app\.post\('\/customer\/settings\/profile', requireCustomerSession, requireCustomerSameOrigin,/);
  assert.match(source, /app\.post\('\/customer\/settings\/password', requireCustomerSession, requireCustomerSameOrigin,/);
  assert.match(source, /app\.post\('\/customer\/settings\/authenticator\/recovery-codes\/regenerate', requireCustomerSession, requireCustomerSameOrigin,/);
  assert.match(source, /app\.post\('\/customer\/settings\/account\/delete', requireCustomerSession, requireCustomerSameOrigin,/);
});


test('settings page exposes authenticated account deactivation controls', () => {
  assert.match(source, /form method="post" action="\/customer\/settings\/account\/deactivate"/);
  assert.match(source, /name="currentPassword" type="password"/);
  assert.match(source, /name="confirmDeactivate" type="checkbox" required/);
  assert.match(source, />Deactivate account<\/button>/);
  assert.match(source, /app\.post\('\/customer\/settings\/account\/deactivate', requireCustomerSession/);
  assert.match(source, /deactivateCustomerAccount\(/);
  assert.match(source, /res\.redirect\(303, '\/login'\)/);
});


test('server trusts only loopback reverse proxy for customer client IP capture', () => {
  assert.match(source, /const app = express\(\);\s*app\.set\('trust proxy', 'loopback'\);/);
  assert.match(source, /ip: req\.ip \|\| req\.socket\?\.remoteAddress/);
});


test('sensitive customer settings mutations are rate limited per account', () => {
  assert.match(source, /createCustomerSensitiveSettingsRateLimiter/);
  assert.match(source, /const customerSensitiveSettingsRateLimiter = createCustomerSensitiveSettingsRateLimiter\(\);/);

  for (const route of [
    '/customer/settings/email',
    '/customer/settings/account/delete',
    '/customer/settings/account/deactivate',
    '/customer/settings/sessions/revoke',
    '/customer/settings/authenticator/start',
    '/customer/settings/authenticator/confirm',
    '/customer/settings/authenticator/recovery-codes/regenerate',
    '/customer/settings/authenticator/disable',
    '/customer/settings/password',
  ]) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const routeSource = source.match(
      new RegExp(`app\\.post\\('${escaped}'[\\s\\S]*?\\n\\}\\);`),
    )?.[0] ?? '';

    assert.match(routeSource, /customerSensitiveSettingsRateLimiter\.isLimited\(req\)/);
    assert.match(routeSource, /status\(429\)/);
    assert.match(routeSource, /Retry-After/);
  }
});


test('successful password changes append a customer security audit record', () => {
  assert.match(source, /appendCustomerSecurityAuditRecord/);
  assert.match(source, /function recordCustomerSecurityAudit\(req, eventType, outcome, reason, accountId\)/);
  assert.match(source, /recordCustomerSecurityAudit\(req, 'password_changed', 'success'\);/);
});


test('successful email change requests append a customer security audit record', () => {
  assert.match(source, /recordCustomerSecurityAudit\(req, 'email_change_requested', 'success'\);/);
});

test('successful account and session security mutations append customer security audit records', () => {
  for (const eventType of [
    'account_deleted',
    'account_deactivated',
    'sessions_revoked',
  ]) {
    assert.match(
      source,
      new RegExp(`recordCustomerSecurityAudit\\(req, '${eventType}', 'success'\\);`),
    );
  }
});


test('successful authenticator security mutations append customer security audit records', () => {
  for (const eventType of [
    'authenticator_setup_started',
    'authenticator_enabled',
    'authenticator_recovery_codes_regenerated',
    'authenticator_disabled',
  ]) {
    assert.match(
      source,
      new RegExp(`recordCustomerSecurityAudit\\(req, '${eventType}', 'success'\\);`),
    );
  }
});


test('customer security activity uses a separate authenticated read-only page', () => {
  assert.match(source, /app\.get\('\/customer\/security-activity', requireCustomerSession,/);
  assert.match(source, /listCustomerSecurityActivity\(req\.customerAccount\?\.id, \{ limit: 50 \}\)/);
  assert.match(source, /renderCustomerSecurityActivityPageHtml\(page\)/);
  assert.match(source, /href="\/customer\/security-activity">View security activity<\/a>/);
  assert.doesNotMatch(source, /securityActivity\.map\(\(entry\)/);
});


test('password change failures and rate limits append bounded customer security audit records', () => {
  const routeSource = source.match(
    /app\.post\('\/customer\/settings\/password'[\s\S]*?\n\}\);/,
  )?.[0] ?? '';

  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'password_change_attempt', 'blocked', 'rate_limited'\);/,
  );
  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'password_change_attempt', 'failure', 'password_confirmation_mismatch'\);/,
  );
  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'password_change_attempt', 'failure', result\.reason\);/,
  );
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*currentPassword/);
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*newPassword/);
});


test('email change failures and rate limits append bounded customer security audit records', () => {
  const routeSource = source.match(
    /app\.post\('\/customer\/settings\/email'[\s\S]*?\n\}\);/,
  )?.[0] ?? '';

  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'email_change_attempt', 'blocked', 'rate_limited'\);/,
  );
  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'email_change_attempt', 'failure', result\.reason\);/,
  );
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*currentPassword/);
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*newEmail/);
});


test('account deletion, deactivation, and session revoke failures append bounded customer security audit records', () => {
  const cases = [
    {
      route: '/customer/settings/account/delete',
      eventType: 'account_delete_attempt',
      confirmationReason: 'confirmation_required',
    },
    {
      route: '/customer/settings/account/deactivate',
      eventType: 'account_deactivate_attempt',
      confirmationReason: 'confirmation_required',
    },
    {
      route: '/customer/settings/sessions/revoke',
      eventType: 'sessions_revoke_attempt',
      confirmationReason: null,
    },
  ];

  for (const item of cases) {
    const routeStart = source.indexOf(`app.post('${item.route}'`);
    assert.notEqual(routeStart, -1);

    const nextRouteStart = source.indexOf("\napp.", routeStart + 1);
    const routeSource = source.slice(
      routeStart,
      nextRouteStart === -1 ? source.length : nextRouteStart,
    );

    assert.match(
      routeSource,
      new RegExp(`recordCustomerSecurityAudit\\(req, '${item.eventType}', 'blocked', 'rate_limited'\\);`),
    );
    assert.match(
      routeSource,
      new RegExp(`recordCustomerSecurityAudit\\(req, '${item.eventType}', 'failure', result\.reason\\);`),
    );

    if (item.confirmationReason) {
      assert.match(
        routeSource,
        new RegExp(`recordCustomerSecurityAudit\\(req, '${item.eventType}', 'failure', '${item.confirmationReason}'\\);`),
      );
    }

    assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*currentPassword/);
  }
});


test('authenticator failures and rate limits append bounded customer security audit records', () => {
  const cases = [
    ['/customer/settings/authenticator/start', 'authenticator_setup_attempt'],
    ['/customer/settings/authenticator/confirm', 'authenticator_confirm_attempt'],
    ['/customer/settings/authenticator/recovery-codes/regenerate', 'authenticator_recovery_codes_attempt'],
    ['/customer/settings/authenticator/disable', 'authenticator_disable_attempt'],
  ];

  for (const [route, eventType] of cases) {
    const routeStart = source.indexOf(`app.post('${route}'`);
    assert.notEqual(routeStart, -1);

    const nextRouteStart = source.indexOf('\napp.', routeStart + 1);
    const routeSource = source.slice(
      routeStart,
      nextRouteStart === -1 ? source.length : nextRouteStart,
    );

    assert.ok(routeSource.includes(
      `recordCustomerSecurityAudit(req, '${eventType}', 'blocked', 'rate_limited');`,
    ));
    assert.ok(routeSource.includes(
      `recordCustomerSecurityAudit(req, '${eventType}', 'failure', result.reason);`,
    ));
    assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*currentPassword/);
    assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*authenticatorCode/);
  }
});


test('customer data export outcomes append bounded customer security audit records', () => {
  const routeStart = source.indexOf("app.post('/customer/settings/data/export'");
  assert.notEqual(routeStart, -1);

  const nextRouteStart = source.indexOf('\napp.', routeStart + 1);
  const routeSource = source.slice(
    routeStart,
    nextRouteStart === -1 ? source.length : nextRouteStart,
  );

  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'data_export_attempt', 'failure', result\.reason\);/,
  );
  assert.match(
    routeSource,
    /recordCustomerSecurityAudit\(req, 'data_exported', 'success'\);/,
  );
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*authenticatorMasterKey/);
  assert.doesNotMatch(routeSource, /recordCustomerSecurityAudit\([^)]*result\.export/);
});

test('customer login outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/login'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf('\n\nconst customerPasswordResetRateLimiter', routeStart);
  const routeSource = source.slice(
    routeStart,
    routeEnd === -1 ? source.length : routeEnd,
  );

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'login_attempt', 'blocked', 'rate_limited');"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'login_attempt', 'failure', result.reason);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'login_attempt', 'failure', loginRecord.reason, result.account.id);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'login_success', 'success', undefined, loginRecord.account.id);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.password"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.authenticatorCode"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.authenticatorRecoveryCode"), false);
});

test('customer security audit helper accepts an explicit public-route account id', () => {
  assert.equal(
    source.includes('function recordCustomerSecurityAudit(req, eventType, outcome, reason, accountId)'),
    true,
  );
  assert.equal(
    source.includes('accountId: accountId ?? req.customerAccount?.id'),
    true,
  );
});

test('customer logout appends a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/logout'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.get('/',", routeStart);
  const routeSource = source.slice(
    routeStart,
    routeEnd === -1 ? source.length : routeEnd,
  );

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'logout', 'success');"),
    true,
  );
  assert.equal(routeSource.includes('req.body'), false);
});

test('customer password reset rate limits append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/forgot-password'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.get('/reset-password'", routeStart);
  const routeSource = source.slice(
    routeStart,
    routeEnd === -1 ? source.length : routeEnd,
   );

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset_request', 'blocked', 'rate_limited');"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset_request', 'failure', 'account_unavailable');"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset_request', 'failure', 'delivery_failed', account.id);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset_requested', 'success', undefined, account.id);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.email"), false);
});

test('customer reset-password confirmation mismatches append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/reset-password'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset', 'failure', 'password_confirmation_mismatch');"),
    true,
  );
  assert.equal(routeSource.includes('recordCustomerSecurityAudit(req, token'), false);
  assert.equal(routeSource.includes('recordCustomerSecurityAudit(req, newPassword'), false);
});

test('customer reset-password invalid tokens append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/reset-password'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset', 'failure', 'invalid_or_expired_token');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, token"), false);
});

test('customer reset-password outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/reset-password'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset', 'failure', changed.reason ?? 'password_reset_failed', verified.accountId);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'password_reset', 'success', undefined, verified.accountId);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, newPassword"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, token"), false);
});

test('customer signup rate limits append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'rate_limited');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.email"), false);
});

test('customer signup disabled attempts append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'signup_disabled');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.email"), false);
});

test('customer signup unavailable email delivery appends a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'blocked', 'email_delivery_unavailable');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, process.env.RESEND_API_KEY"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, process.env.CUSTOMER_EMAIL_FROM"), false);
});

test('customer signup duplicate accounts append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'account_already_exists', existingAccount.id);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.email"), false);
});

test('customer signup verification delivery failures append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'verification_delivery_failed', record.id);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, verification.token"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, record.email"), false);
});

test('customer signup success and validation failures append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/signup'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_created', 'success', undefined, record.id);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'signup_attempt', 'failure', 'invalid_signup');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, codes"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, error?.codes"), false);
});

test('customer email verification invalid tokens append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.get('/verify-email'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'email_verification', 'failure', 'invalid_or_expired_token');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, token"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, tokenHash"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, verificationRecord"), false);
});

test('customer email verification account update failures append a bounded security audit record', () => {
  const routeStart = source.indexOf("app.get('/verify-email'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'email_verification', 'failure', 'account_update_failed', result.accountId);"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, accountResult"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, result.email"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, token"), false);
});

test('customer email verification success outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.get('/verify-email'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("isEmailChange ? 'email_change_verified' : 'email_verified'"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(\n    req,\n    isEmailChange ? 'email_change_verified' : 'email_verified',\n    'success',\n    undefined,\n    result.accountId,\n  );"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, result.email"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, token"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, verificationRecord"), false);
});

test('customer profile update outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/customer/settings/profile'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'profile_update', 'failure', result.reason);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'profile_updated', 'success');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.firstName"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.lastName"), false);
});

test('customer notification preference outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/customer/settings/notifications'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'notification_preferences_update', 'failure', result.reason);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'notification_preferences_updated', 'success');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.scannerAlerts"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.productUpdates"), false);
});

test('customer display preference outcomes append bounded security audit records', () => {
  const routeStart = source.indexOf("app.post('/customer/settings/display'");
  assert.notEqual(routeStart, -1);

  const routeEnd = source.indexOf("\n\napp.", routeStart + 1);
  const routeSource = source.slice(routeStart, routeEnd === -1 ? source.length : routeEnd);

  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'display_preferences_update', 'failure', result.reason);"),
    true,
  );
  assert.equal(
    routeSource.includes("recordCustomerSecurityAudit(req, 'display_preferences_updated', 'success');"),
    true,
  );
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.theme"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.timezone"), false);
  assert.equal(routeSource.includes("recordCustomerSecurityAudit(req, req.body?.locale"), false);
});

test('every customer settings mutation route records a bounded security audit outcome', () => {
  const routeStarts = [...source.matchAll(/app\.post\('\/customer\/settings\/([^']+)'/g)];

  assert.equal(routeStarts.length, 14);

  for (let index = 0; index < routeStarts.length; index += 1) {
    const match = routeStarts[index];
    const routeName = match[1];
    const start = match.index;
    const end = index + 1 < routeStarts.length
      ? routeStarts[index + 1].index
      : source.indexOf('\n\napp.', start + 1);
    const routeSource = source.slice(start, end === -1 ? source.length : end);

    assert.equal(
      routeSource.includes('recordCustomerSecurityAudit(req,'),
      true,
      `missing customer security audit for /customer/settings/${routeName}`,
    );
  }
});


test('Customer Zero result filters use authenticated persistent settings storage', () => {
  assert.match(source, /getCustomerZeroResultFilters\(account\?\.id\)\.filters\.states\.includes\(state\)/);
  assert.match(source, /app\.post\('\/customer\/settings\/customer-zero-filters', requireCustomerSession, requireCustomerSameOrigin,/);
  assert.match(source, /updateCustomerZeroResultFilters\(\s*req\.customerAccount\.id,/);
  assert.match(source, /recordCustomerSecurityAudit\(req, 'customer_zero_result_filters_updated', 'success'\);/);
  assert.match(source, /res\.redirect\(303, '\/customer\/settings'\)/);
});

test('customer watchlist uses authenticated persistent storage and same-origin mutation protection', () => {
  assert.match(source, /getCustomerWatchlist\(req\.customerAccount\?\.id\)/);
  assert.match(source, /renderCustomerWatchlistPageHtml\(page, req\.customerAccount\)/);
  assert.match(source, /app\.post\('\/customer\/watchlist', requireCustomerSession, requireCustomerSameOrigin,/);
  assert.match(source, /updateCustomerWatchlist\(req\.customerAccount\?\.id, symbols\)/);
  assert.match(source, /res\.redirect\(303, '\/customer\/watchlist\?saved=1'\)/);
});

test('customer login renders shared public neon theme and fixed background logo', () => {
  assert.match(source, /renderGlobalThemeCss\(\{ surface: 'public' \}\)/);
  assert.match(source, /renderBackgroundLogoLayer\(\)/);
  assert.match(source, /renderGlobalHeader\(\{ surface: 'public'/);
  assert.match(source, /renderGlobalFooter\(\)/);
  assert.match(source, /data-gs-page="customer-login"/);
});
