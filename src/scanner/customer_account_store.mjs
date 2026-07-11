import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "customer_account_store_v1";
const DEFAULT_STORE_PATH = path.resolve("runs/customer_accounts.jsonl");

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeCustomerEmail(value) {
  return clean(value).toLowerCase();
}

export function validateSignupInput(input = {}) {
  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const email = normalizeCustomerEmail(input.email);
  const password = String(input.password ?? "");
  const confirmPassword = String(input.confirmPassword ?? "");
  const errors = [];

  if (!firstName) errors.push("first_name_required");
  if (!lastName) errors.push("last_name_required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("valid_email_required");
  if (password.length < 12) errors.push("password_too_short");
  if (password !== confirmPassword) errors.push("passwords_do_not_match");
  if (input.termsAccepted !== true && input.termsAccepted !== "on") errors.push("terms_required");

  return Object.freeze({
    ok: errors.length === 0,
    errors: Object.freeze(errors),
    value: Object.freeze({ firstName, lastName, email }),
  });
}

export function hashCustomerPassword(password, salt = crypto.randomBytes(16)) {
  const saltBuffer = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt), "base64");
  const derived = crypto.scryptSync(String(password), saltBuffer, 64);
  return Object.freeze({
    algorithm: "scrypt",
    salt: saltBuffer.toString("base64"),
    hash: derived.toString("base64"),
  });
}

export function verifyCustomerPassword(password, record = {}) {
  const expected = Buffer.from(clean(record.hash), "base64");
  const actual = crypto.scryptSync(String(password), Buffer.from(clean(record.salt), "base64"), expected.length);
  return expected.length > 0 && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function createCustomerAccountRecord(input = {}, options = {}) {
  const validation = validateSignupInput(input);
  if (!validation.ok) {
    const error = new Error("invalid_signup");
    error.codes = validation.errors;
    throw error;
  }

  const password = hashCustomerPassword(input.password);
  return Object.freeze({
    version: VERSION,
    id: crypto.randomUUID(),
    role: "customer",
    firstName: validation.value.firstName,
    lastName: validation.value.lastName,
    email: validation.value.email,
    password,
    emailVerified: false,
    authenticatorEnabled: false,
    status: "pending_email_verification",
    createdAt: options.now ?? new Date().toISOString(),
  });
}

export function listCustomerAccountRecords(options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  if (!fs.existsSync(storePath)) return Object.freeze([]);
  const records = fs.readFileSync(storePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return Object.freeze(records);
}

export function findCustomerAccountByEmail(email, options = {}) {
  const normalized = normalizeCustomerEmail(email);
  return listCustomerAccountRecords(options).find((record) => record.email === normalized) ?? null;
}

export function appendCustomerAccountRecord(record, options = {}) {
  const storePath = clean(options.storePath) || DEFAULT_STORE_PATH;
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.appendFileSync(storePath, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.chmodSync(storePath, 0o600);
  return Object.freeze({ ok: true, storePathLabel: path.basename(storePath) });
}
