const PLACEHOLDER_SECRETS = new Set([
  'change-me',
  'changeme',
  'replace-me',
  'replace_this',
  'secret',
  'test-secret',
  'your-secret',
  'your_secret_here',
]);

export function validateCustomerSessionSecret(value, { minLength = 32 } = {}) {
  const secret = String(value ?? '').trim();

  if (!secret) {
    throw new Error('customer_session_secret_required');
  }

  if (!Number.isInteger(minLength) || minLength < 1) {
    throw new Error('customer_session_secret_min_length_invalid');
  }

  if (secret.length < minLength) {
    throw new Error('customer_session_secret_too_short');
  }

  if (PLACEHOLDER_SECRETS.has(secret.toLowerCase())) {
    throw new Error('customer_session_secret_placeholder');
  }

  return secret;
}
