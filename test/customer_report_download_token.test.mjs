import test from "node:test";
import assert from "node:assert/strict";
import {
  createCustomerReportDownloadToken,
  verifyCustomerReportDownloadToken,
} from "../src/scanner/customer_report_download_token.mjs";

const secret = "test-report-download-secret-32-bytes-minimum";
const now = Date.parse("2026-09-02T01:00:00Z");

test("report token verifies and expires", () => {
  const token = createCustomerReportDownloadToken(
    { accountId: "a", period: "daily" },
    { secret, nowMs: now, ttlSec: 60 },
  );
  assert.equal(verifyCustomerReportDownloadToken(token, { secret, nowMs: now + 1000 }).ok, true);
  assert.equal(verifyCustomerReportDownloadToken(token, { secret, nowMs: now + 61000 }).ok, false);
});

test("report token rejects tampering and unsupported periods", () => {
  const token = createCustomerReportDownloadToken(
    { accountId: "a", period: "weekly" },
    { secret, nowMs: now, ttlSec: 60 },
  );
  assert.equal(verifyCustomerReportDownloadToken(`${token}x`, { secret, nowMs: now + 1000 }).ok, false);
  assert.throws(
    () => createCustomerReportDownloadToken(
      { accountId: "a", period: "arbitrary" },
      { secret, nowMs: now, ttlSec: 60 },
    ),
    /customer_report_download_identity_required/,
  );
});

test("report token rejects invalid or excessive TTL", () => {
  assert.throws(
    () => createCustomerReportDownloadToken(
      { accountId: "a", period: "daily" },
      { secret, nowMs: now, ttlSec: 0 },
    ),
     /customer_report_download_ttl_invalid/,
  );
  assert.throws(
    () => createCustomerReportDownloadToken(
      { accountId: "a", period: "daily" },
      { secret, nowMs: now, ttlSec: 8 * 86400 },
    ),
    /customer_report_download_ttl_invalid/,
  );
});
