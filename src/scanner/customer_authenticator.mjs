import crypto from "node:crypto";

export const VERSION = "customer_authenticator_v1";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function clean(value) {
  return String(value ?? "").trim().replaceAll(" ", "").toUpperCase();
}

function decodeBase32(value) {
  const source = clean(value).replace(/=+$/g, "");
  let bits = "";
  for (const char of source) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("invalid_base32_secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateCustomerAuthenticatorSecret(options = {}) {
  const bytes = options.bytes ?? crypto.randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let index = 0; index < bits.length; index += 5) {
    secret += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return secret;
}

export function customerAuthenticatorCode(secret, options = {}) {
  const periodSec = Number(options.periodSec ?? 30);
  const digits = Number(options.digits ?? 6);
  const counter = BigInt(Math.floor((options.nowMs ?? Date.now()) / 1000 / periodSec));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(counter);
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % (10 ** digits)).padStart(digits, "0");
}

export function verifyCustomerAuthenticatorCode(secret, code, options = {}) {
  const supplied = String(code ?? "").trim();
  if (!/^\d{6}$/.test(supplied)) return false;
  const window = Number(options.window ?? 1);
  const periodMs = Number(options.periodSec ?? 30) * 1000;
  const nowMs = Number(options.nowMs ?? Date.now());
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = customerAuthenticatorCode(secret, { ...options, nowMs: nowMs + offset * periodMs });
    const actualBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length === expectedBuffer.length
      && crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) return true;
  }
  return false;
}
