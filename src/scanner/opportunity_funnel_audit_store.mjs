import fs from "node:fs";
import path from "node:path";

export const VERSION = "opportunity_funnel_audit_store_v1";
export const DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH =
  path.resolve("runs/opportunity_funnel_audit.jsonl");
export const DEFAULT_MAX_BYTES_READ = 32 * 1024 * 1024;
export const DEFAULT_MAX_AUDIT_FILE_BYTES = 64 * 1024 * 1024;
export const DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_DIR =
  path.resolve("runs/archive");
export const DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_RETENTION_DAYS = 30;
export const DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVES = 30;
export const DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_BYTES = 4 * 1024 * 1024 * 1024;
export const MAX_AUDIT_CANDIDATES = 500;

function clean(value, maxLength = 256) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function list(value, maxItems = 20, maxLength = 128) {
  return Object.freeze(
    (Array.isArray(value) ? value : [])
      .slice(0, maxItems)
      .map((item) => clean(item, maxLength))
      .filter(Boolean),
  );
}

export function buildOpportunityFunnelAuditRecord(input = {}, options = {}) {
  const now = options.now instanceof Date
    ? options.now
    : new Date(options.now ?? Date.now());

  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("now must be a valid Date");
  }

  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const maxCandidates = Math.max(
    0,
    Math.min(
      MAX_AUDIT_CANDIDATES,
      Number.isFinite(Number(options.maxCandidates))
        ? Math.trunc(Number(options.maxCandidates))
        : MAX_AUDIT_CANDIDATES,
    ),
  );
  const decisionCounts = candidates.reduce((counts, candidate) => {
    const decision = clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN";
    counts[decision] = (counts[decision] ?? 0) + 1;
    return counts;
  }, {});

  const record = {
    version: VERSION,
    eventAt: now.toISOString(),
    scanId: clean(input.scanId, 128) || `scan-${now.getTime()}`,
    scanner: clean(input.scanner, 64) || "alpaca_under_five_shared",
    scanType: clean(input.scanType, 32) || (
      clean(input.scanner, 64).includes("premarket") ? "premarket"
        : clean(input.scanner, 64).includes("under_five") ? "under_five"
          : "manual"
    ),
    sourceVersion: clean(input.sourceVersion, 128) || null,
    sourceStatus: clean(input.sourceStatus, 64) || "unknown",
    marketOpen: input.marketOpen === true,
    assetCount: finite(input.assetCount) ?? 0,
    snapshotCount: finite(input.snapshotCount) ?? 0,
    candidateCount: finite(input.candidateCount) ?? candidates.length,
    decisionCounts: Object.freeze({ ...decisionCounts }),
    candidates: Object.freeze(candidates.slice(0, maxCandidates).map((candidate) => Object.freeze({
      symbol: clean(candidate?.symbol, 20).toUpperCase(),
      price: finite(candidate?.price),
      changePct: finite(candidate?.changePct),
      premarketGapPct: finite(candidate?.premarketGapPct),
      momentumPct: finite(candidate?.momentumPct ?? candidate?.changePct),
      spreadPct: finite(candidate?.spreadPct),
      dollarVolume: finite(candidate?.dollarVolume),
      readonlyPotentialScore: finite(candidate?.readonlyPotentialScore),
      decision: clean(candidate?.decision, 32).toUpperCase() || "UNKNOWN",
      resultState: clean(candidate?.resultState, 32).toUpperCase() || null,
      blockingFlags: list(candidate?.blockingFlags),
      potentialFlags: list(candidate?.readonlyPotentialFlags),
      staleReasons: list(candidate?.staleReasons),
      sourceStale: candidate?.sourceStale === true,
      rankingConnected: candidate?.rankingConnected === true,
      rankingSetupScore: finite(candidate?.rankingSetupScore),
      rankingConfidence: finite(candidate?.rankingConfidence),
      rankingQuality: finite(candidate?.rankingQuality),
    }))),
    readOnly: true,
    paperOnly: true,
    decisionAssistOnly: true,
    localStoreOnly: true,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
  };

  return Object.freeze(record);
}

function archiveTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (!Number.isFinite(date.getTime())) throw new TypeError("now must be a valid Date");
  return date.toISOString().replace(/[-:.]/g, "");
}

export function rotateOpportunityFunnelAuditIfNeeded(options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  const archiveDir =
    clean(options.archiveDir, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_DIR;
  const maxFileBytes = Math.max(
    1,
    Math.min(
      4 * 1024 * 1024 * 1024,
      Number(options.maxFileBytes) || DEFAULT_MAX_AUDIT_FILE_BYTES,
    ),
  );

  if (!fs.existsSync(auditPath)) {
    return Object.freeze({ ok: true, rotated: false, reason: "audit_file_missing", auditPath, archivePath: null, maxFileBytes });
  }

  const stat = fs.statSync(auditPath);
  if (stat.size < maxFileBytes) {
    return Object.freeze({ ok: true, rotated: false, reason: "below_size_threshold", auditPath, archivePath: null, fileBytes: stat.size, maxFileBytes });
  }

  fs.mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(archiveDir, 0o700);
  const extension = path.extname(auditPath) || ".jsonl";
  const baseName = path.basename(auditPath, extension);
  const stamp = archiveTimestamp(options.now);
  let archivePath = path.join(archiveDir, `${baseName}-${stamp}${extension}`);
  let suffix = 1;
  while (fs.existsSync(archivePath)) {
    archivePath = path.join(archiveDir, `${baseName}-${stamp}-${suffix}${extension}`);
    suffix += 1;
  }

  fs.renameSync(auditPath, archivePath);
  fs.chmodSync(archivePath, 0o600);
  return Object.freeze({ ok: true, rotated: true, reason: "size_threshold_reached", auditPath, archivePath, fileBytes: stat.size, maxFileBytes });
}

export function inspectOpportunityFunnelAuditArchiveRetention(options = {}) {
  const archiveDir =
    clean(options.archiveDir, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_DIR;
  const now = options.now instanceof Date
    ? options.now
    : new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid Date");

  const retentionDays = Math.max(
    1,
    Math.min(
      3650,
      Number(options.retentionDays)
        || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_RETENTION_DAYS,
    ),
  );
  const maxArchives = Math.max(
    1,
    Math.min(
      10000,
      Number(options.maxArchives)
        || DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVES,
    ),
  );
  const maxTotalBytes = Math.max(
    1,
    Math.min(
      1024 * 1024 * 1024 * 1024,
      Number(options.maxTotalBytes)
        || DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_BYTES,
    ),
  );
  const cutoffMs = now.getTime() - retentionDays * 86400000;

  if (!fs.existsSync(archiveDir)) {
    return Object.freeze({
      ok: true,
      status: "archive_directory_missing",
      archiveDir,
      retentionDays,
      maxArchives,
      maxTotalBytes,
      archiveCount: 0,
      totalBytes: 0,
      archives: Object.freeze([]),
      candidateCount: 0,
      candidates: Object.freeze([]),
      cleanupDeletionAllowed: false,
      cleanupExecutionAllowed: false,
      readOnly: true,
      localStoreOnly: true,
    });
  }

  const files = fs.readdirSync(archiveDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^opportunity_funnel_audit-.*\.jsonl$/i.test(entry.name))
    .map((entry) => {
      const fullPath = path.join(archiveDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        path: fullPath,
        bytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        modifiedAtMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs);

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  let retainedBytes = totalBytes;
  const byteLimitCandidateNames = new Set();
  for (
    let index = files.length - 1;
    index >= 0 && retainedBytes > maxTotalBytes;
    index -= 1
  ) {
    byteLimitCandidateNames.add(files[index].name);
    retainedBytes -= files[index].bytes;
  }

  const candidates = [];
  files.forEach((file, index) => {
    const reasons = [];
    if (file.modifiedAtMs < cutoffMs) reasons.push("older_than_retention_days");
    if (index >= maxArchives) reasons.push("archive_count_limit_exceeded");
    if (byteLimitCandidateNames.has(file.name)) {
      reasons.push("archive_byte_limit_exceeded");
    }
    if (reasons.length) {
      candidates.push(Object.freeze({
        ...file,
        reasons: Object.freeze(reasons),
        previewOnly: true,
        wouldDelete: false,
      }));
    }
  });

  return Object.freeze({
    ok: true,
    status: candidates.length
      ? "retention_cleanup_candidates_detected_read_only"
      : "within_retention_policy",
    archiveDir,
    retentionDays,
    maxArchives,
    maxTotalBytes,
    archiveCount: files.length,
    totalBytes,
    archives: Object.freeze(files.map((file) => Object.freeze({
      name: file.name,
      path: file.path,
      bytes: file.bytes,
      modifiedAt: file.modifiedAt,
    }))),
    candidateCount: candidates.length,
    candidates: Object.freeze(candidates),
    cleanupDeletionAllowed: false,
    cleanupExecutionAllowed: false,
    readOnly: true,
    localStoreOnly: true,
  });
}

export function appendOpportunityFunnelAuditRecord(input = {}, options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  const record = buildOpportunityFunnelAuditRecord(input, options);
  const rotation = rotateOpportunityFunnelAuditIfNeeded({
    auditPath,
    archiveDir: options.archiveDir,
    maxFileBytes: options.maxFileBytes,
    now: options.now,
  });

  fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
  fs.appendFileSync(auditPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.chmodSync(auditPath, 0o600);

  return Object.freeze({
    ok: true,
    appended: true,
    record,
    auditPath,
    rotation,
  });
}

export function listOpportunityFunnelAuditRecords(options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  if (!fs.existsSync(auditPath)) return Object.freeze([]);

  const maxRecords = Math.max(1, Math.min(1000, Number(options.maxRecords) || 100));
  const chunkSize = Math.max(
    4096,
    Math.min(1024 * 1024, Number(options.chunkSize) || 64 * 1024),
  );
  const maxBytesRead = Math.max(
    1,
    Math.min(
      256 * 1024 * 1024,
      Number(options.maxBytesRead) || DEFAULT_MAX_BYTES_READ,
    ),
  );
  const fd = fs.openSync(auditPath, "r");

  try {
    const stat = fs.fstatSync(fd);
    let position = stat.size;
    let text = "";
    let newlineCount = 0;
    let bytesReadTotal = 0;

    while (
      position > 0
      && newlineCount <= maxRecords
      && bytesReadTotal < maxBytesRead
    ) {
      const bytesToRead = Math.min(
        chunkSize,
        position,
        maxBytesRead - bytesReadTotal,
      );
      position -= bytesToRead;
      const buffer = Buffer.allocUnsafe(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, position);
      bytesReadTotal += bytesRead;
      const chunk = buffer.subarray(0, bytesRead).toString("utf8");
      text = chunk + text;
      newlineCount += (chunk.match(/\n/g) ?? []).length;
    }

    let startsAtLineBoundary = position === 0;
    if (position > 0) {
      const previousByte = Buffer.allocUnsafe(1);
      const previousBytesRead = fs.readSync(
        fd,
        previousByte,
        0,
        1,
        position - 1,
      );
      startsAtLineBoundary =
        previousBytesRead === 1 && previousByte[0] === 0x0a;
    }

    const lines = text
      .split(/\r?\n/)
      .filter(Boolean);

    if (!startsAtLineBoundary) lines.shift();

    const records = lines
      .slice(-maxRecords)
      .map((line) => JSON.parse(line))
      .reverse()
      .map((record) => Object.freeze(record));

    return Object.freeze(records);
  } finally {
    fs.closeSync(fd);
  }
}


export function listOpportunityFunnelAuditRecordsFiltered(options = {}) {
  const auditPath =
    clean(options.auditPath, 4096) || DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH;
  if (!fs.existsSync(auditPath)) return Object.freeze([]);

  const maxRecords = Math.max(1, Math.min(1000, Number(options.maxRecords) || 100));
  const chunkSize = Math.max(
    4096,
    Math.min(1024 * 1024, Number(options.chunkSize) || 64 * 1024),
  );
  const maxBytesRead = Math.max(
    1,
    Math.min(
      256 * 1024 * 1024,
      Number(options.maxBytesRead) || DEFAULT_MAX_BYTES_READ,
    ),
  );
  const scanner = clean(options.scanner, 64);
  const scanType = clean(options.scanType, 32);
  const fd = fs.openSync(auditPath, "r");

  try {
    const stat = fs.fstatSync(fd);
    let position = stat.size;
    let carry = "";
    let bytesReadTotal = 0;
    const records = [];

    const considerLine = (line) => {
      if (!line || records.length >= maxRecords) return;
      const record = JSON.parse(line);
      if (scanner && clean(record?.scanner, 64) !== scanner) return;
      if (scanType && clean(record?.scanType, 32) !== scanType) return;
      records.push(Object.freeze(record));
    };

    while (
      position > 0
      && records.length < maxRecords
      && bytesReadTotal < maxBytesRead
    ) {
      const bytesToRead = Math.min(
        chunkSize,
        position,
        maxBytesRead - bytesReadTotal,
      );
      position -= bytesToRead;
      const buffer = Buffer.allocUnsafe(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, position);
      bytesReadTotal += bytesRead;
      const block = buffer.subarray(0, bytesRead).toString("utf8") + carry;
      const lines = block.split(/\r?\n/);
      carry = lines.shift() ?? "";

      for (
        let index = lines.length - 1;
        index >= 0 && records.length < maxRecords;
        index -= 1
      ) {
        considerLine(lines[index]);
      }
    }

    if (records.length < maxRecords && carry) {
      let startsAtLineBoundary = position === 0;
      if (position > 0) {
        const previousByte = Buffer.allocUnsafe(1);
        const previousBytesRead = fs.readSync(
          fd,
          previousByte,
          0,
          1,
          position - 1,
        );
        startsAtLineBoundary =
          previousBytesRead === 1 && previousByte[0] === 0x0a;
      }
      if (startsAtLineBoundary) considerLine(carry);
    }
    return Object.freeze(records);
  } finally {
    fs.closeSync(fd);
  }
}

export default {
  VERSION,
  DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_PATH,
  DEFAULT_MAX_BYTES_READ,
  DEFAULT_MAX_AUDIT_FILE_BYTES,
  DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_DIR,
  DEFAULT_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_RETENTION_DAYS,
  DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVES,
  DEFAULT_MAX_OPPORTUNITY_FUNNEL_AUDIT_ARCHIVE_BYTES,
  MAX_AUDIT_CANDIDATES,
  buildOpportunityFunnelAuditRecord,
  rotateOpportunityFunnelAuditIfNeeded,
  inspectOpportunityFunnelAuditArchiveRetention,
  appendOpportunityFunnelAuditRecord,
  listOpportunityFunnelAuditRecords,
  listOpportunityFunnelAuditRecordsFiltered,
};
