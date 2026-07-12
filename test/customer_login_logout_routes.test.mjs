import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/server.js', import.meta.url), 'utf8');

test('customer authentication routes exist', () => {
  assert.match(source, /app\.get\('\/login'/);
  assert.match(source, /app\.post\('\/login'/);
  assert.match(source, /app\.post\('\/logout'/);
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
});

test('login submits optional authenticator code for enabled accounts', () => {
  assert.match(source, /name="authenticatorCode"/);
  assert.match(source, /verifyAuthenticatorCode: verifyCustomerAuthenticatorCode/);
  assert.match(source, /result\.reason === 'authenticator_required'/);
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
  assert.match(source, /PASSWORD_RESET_RATE_MAX\s*=\s*5/);
  assert.match(source, /createCustomerPasswordReset\(/);
  assert.match(source, /appendCustomerPasswordResetRecord\(/);
  assert.match(source, /deliverCustomerPasswordResetEmail\(/);
  assert.match(source, /verifyCustomerPasswordResetToken\(/);
  assert.match(source, /resetCustomerPassword\(/);
  assert.match(source, /markCustomerPasswordResetConsumed\(/);
  assert.match(source, /If that email belongs to an active account/);
});
