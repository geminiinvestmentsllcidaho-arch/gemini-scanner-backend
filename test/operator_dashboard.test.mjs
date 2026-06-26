import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OPERATOR_DASHBOARD_VERSION,
  OPERATOR_PANELS,
  buildOperatorDashboardHtml,
  buildOperatorDashboardPayload,
  createRequireOperatorDashboardAuth,
  extractOperatorAuthToken,
  isOperatorDashboardEnabled,
  isStrongOperatorToken,
  registerOperatorDashboardRoutes
} from '../src/operator/operator_dashboard.mjs';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    contentType: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    }
  };
}

test('operator dashboard remains disabled without a strong token', () => {
  assert.equal(isStrongOperatorToken(''), false);
  assert.equal(isStrongOperatorToken('operator'), false);
  assert.equal(isStrongOperatorToken('12345678901234567890'), false);
  assert.equal(isStrongOperatorToken('stage3-operator-token-123456789'), true);
  assert.equal(isOperatorDashboardEnabled({ token: 'stage3-operator-token-123456789' }), true);
});

test('operator dashboard extracts bearer and basic auth tokens', () => {
  const token = 'stage3-operator-token-123456789';
  const basic = Buffer.from('operator:' + token).toString('base64');

  assert.equal(extractOperatorAuthToken({ headers: { authorization: 'Bearer ' + token } }), token);
  assert.equal(extractOperatorAuthToken({ headers: { authorization: 'Basic ' + basic } }), token);
  assert.equal(extractOperatorAuthToken({ headers: { 'x-operator-token': token } }), token);
  assert.equal(extractOperatorAuthToken({ headers: { authorization: 'Digest abc' } }), '');
});

test('operator dashboard accepts bearer authorization with configured token', () => {
  const token = 'stage3-operator-token-123456789';
  const auth = createRequireOperatorDashboardAuth({ token });
  const req = { headers: { authorization: 'Bearer ' + token } };
  const res = createMockRes();
  let nextCalled = false;

  auth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('operator dashboard accepts browser basic auth password token', () => {
  const token = 'stage3-operator-token-123456789';
  const encoded = Buffer.from('operator:' + token).toString('base64');
  const auth = createRequireOperatorDashboardAuth({ token });
  const req = { headers: { authorization: 'Basic ' + encoded } };
  const res = createMockRes();
  let nextCalled = false;

  auth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('operator dashboard rejects unauthorized requests', () => {
  const auth = createRequireOperatorDashboardAuth({ token: 'stage3-operator-token-123456789' });
  const res = createMockRes();

  auth({ headers: {} }, res, () => {
    throw new Error('next should not run');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'operator_auth_required');
  assert.equal(res.headers['WWW-Authenticate'], 'Basic realm="GeminiScanner Operator"');
});

test('operator dashboard payload is read-only and deterministic in shape', () => {
  const payload = buildOperatorDashboardPayload({ now: new Date('2026-06-26T00:00:00.000Z') });

  assert.equal(payload.ok, true);
  assert.equal(payload.version, OPERATOR_DASHBOARD_VERSION);
  assert.equal(payload.mode, 'read_only');
  assert.equal(payload.execution, 'disabled');
  assert.equal(payload.safetyState, 'decision_assist_only');
  assert.equal(payload.brokerExecution, false);
  assert.equal(payload.orderPlacement, false);
  assert.equal(payload.generatedAt, '2026-06-26T00:00:00.000Z');
  assert.equal(payload.summary.panelCount, OPERATOR_PANELS.length);
  assert.ok(payload.panels.length >= 8);
  assert.ok(payload.panels.some((panel) => panel.route === '/health'));
  assert.ok(payload.panels.some((panel) => panel.route === '/readiness'));
  assert.ok(payload.panels.some((panel) => panel.route === '/diagnostics'));
  assert.ok(payload.panels.some((panel) => panel.route === '/scanner/rankings'));
});

test('operator dashboard html exposes deeper operator panels without execution controls', () => {
  const html = buildOperatorDashboardHtml(buildOperatorDashboardPayload({ now: new Date('2026-06-26T00:00:00.000Z') }));

  assert.match(html, /GeminiScanner Operator/);
  assert.match(html, /Read-only operator shell/);
  assert.match(html, /id="operator"/);
  assert.match(html, /id="health"/);
  assert.match(html, /id="readiness"/);
  assert.match(html, /id="diagnostics"/);
  assert.match(html, /id="rankings"/);
  assert.match(html, /id="marketdata"/);
  assert.match(html, /id="runlog"/);
  assert.doesNotMatch(html, /place order/i);
  assert.doesNotMatch(html, /broker execution enabled/i);
});

test('operator dashboard route registration is idempotent', () => {
  const routes = [];
  const app = {
    locals: {},
    get(route, ...handlers) {
      routes.push({ route, handlers });
    }
  };

  const first = registerOperatorDashboardRoutes(app, { token: 'stage3-operator-token-123456789' });
  const second = registerOperatorDashboardRoutes(app, { token: 'stage3-operator-token-123456789' });

  assert.equal(first.registered, true);
  assert.equal(second.registered, false);
  assert.deepEqual(routes.map((route) => route.route), ['/operator', '/operator/status']);
  assert.equal(routes[0].handlers.length, 2);
  assert.equal(routes[1].handlers.length, 2);
});
