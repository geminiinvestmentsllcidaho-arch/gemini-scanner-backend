import assert from 'node:assert/strict';
import test from 'node:test';

import { validateCustomerSessionSecret } from '../src/scanner/customer_session_secret.mjs';

test('rejects missing customer session secret', () => {
  assert.throws(
    () => validateCustomerSessionSecret('   '),
    /customer_session_secret_required/,
  );
});

test('rejects short customer session secret', () => {
  assert.throws(
    () => validateCustomerSessionSecret('short-secret'),
    /customer_session_secret_too_short/,
  );
});

test('rejects placeholder customer session secret', () => {
  assert.throws(
    () => validateCustomerSessionSecret('change-me', { minLength: 1 }),
    /customer_session_secret_placeholder/,
  );
});

test('rejects invalid minimum length configuration', () => {
  assert.throws(
    () => validateCustomerSessionSecret('a'.repeat(64), { minLength: 0 }),
    /customer_session_secret_min_length_invalid/,
  );
});

test('returns trimmed valid customer session secret', () => {
  const secret = 'a'.repeat(64);
  assert.equal(validateCustomerSessionSecret(`  ${secret}  `), secret);
});
