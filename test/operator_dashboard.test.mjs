import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPERATOR_DASHBOARD_VERSION,
  buildOperatorDashboardPayload,
  getOperatorDashboardConfig,
  isOperatorAuthorized,
  readOperatorAuthToken,
  registerOperatorDashboardRoutes,
  timingSafeCompare
} from '../src/operator/operator_dashboard.mjs';

test('operator dashboard remains disabled without a strong token', () => {
  assert.deepEqual(getOperatorDashboardConfig({}), {
    enabled: false,
    token: '',
    minTokenLength: 24,
    authSchemes: ['Basic password', 'Bearer token']
  });

  assert.equal(getOperatorDashboardConfig({ GEMINI_OPERATOR_TOKEN: 'short' }).enabled, false);
});

test('operator dashboard accepts bearer authorization with configured token', () => {
  const token = 'stage3-operator-token-123456789';
  const req = { headers: { authorization: 'Bearer ' + token } };

  assert.equal(readOperatorAuthToken(req), token);
  assert.equal(isOperatorAuthorized(req, { GEMINI_OPERATOR_TOKEN: token }), true);
  assert.equal(isOperatorAuthorized(req, { GEMINI_OPERATOR_TOKEN: token + '-wrong' }), false);
});

test('operator dashboard accepts browser basic auth password token', () => {
  const token = 'stage3-basic-token-123456789';
  const encoded = Buffer.from('operator:' + token).toString('base64');
  const req = { headers: { authorization: 'Basic ' + encoded } };

  assert.equal(readOperatorAuthToken(req), token);
  assert.equal(isOperatorAuthorized(req, { OPERATOR_DASHBOARD_TOKEN: token }), true);
});

test('timing safe compare rejects empty and mismatched values', () => {
  assert.equal(timingSafeCompare('', ''), false);
  assert.equal(timingSafeCompare('abc', 'abcd'), false);
  assert.equal(timingSafeCompare('abc', 'abc'), true);
});

test('operator dashboard payload is read-only and deterministic in shape', () => {
  const payload = buildOperatorDashboardPayload(new Date('2026-01-01T00:00:00.000Z'));

  assert.equal(payload.ok, true);
  assert.equal(payload.version, OPERATOR_DASHBOARD_VERSION);
  assert.equal(payload.mode, 'read_only');
  assert.equal(payload.execution, 'disabled');
  assert.equal(payload.safetyState, 'decision_assist_only');
  assert.equal(payload.generatedAt, '2026-01-01T00:00:00.000Z');
  assert.ok(payload.panels.some((panel) => panel.route === '/scanner/stage2-app'));
});

test('operator dashboard route registration is idempotent', () => {
  const routes = [];
  const app = {
    get(route, ...handlers) {
      routes.push({ route, handlers });
    }
  };

  registerOperatorDashboardRoutes(app);
  registerOperatorDashboardRoutes(app);

  assert.equal(app.__geminiOperatorDashboardRoutesRegistered, true);
  assert.deepEqual(routes.map((route) => route.route), ['/operator', '/operator/status']);
});
