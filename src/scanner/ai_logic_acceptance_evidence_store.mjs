import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { verifyImmutablePolicyManifest } from "./ai_logic_immutable_manifest.mjs";

export const VERSION = "ai_logic_acceptance_evidence_store_v1";
export const DEFAULT_AI_LOGIC_ACCEPTANCE_EVIDENCE_PATH =
  path.resolve("runs/ai_logic_acceptance_evidence.jsonl");

const clean = (value, max = 256) => String(value ?? "").trim().slice(0, max);

export function buildAiLogicAcceptanceEvidenceRecord(binding = {}, options = {}) {
  const manifest = verifyImmutablePolicyManifest();
  if (manifest.ok !== true || manifest.status !== "IMMUTABLE_MANIFEST_VERIFIED") {
    throw new Error("immutable_manifest_not_verified");
  }
  if (binding.eligible !== true) throw new Error("acceptance_binding_not_eligible");
  if (binding.status !== "AI_LOGIC_ACCEPTANCE_EVIDENCE_BINDING_VALID") {
    throw new Error("acceptance_binding_status_invalid");
  }
  if (binding.disposition !== "OFFLINE_ACCEPTANCE_BINDING_EVIDENCE_ONLY") {
    throw new Error("acceptance_binding_disposition_invalid");
  }
  const b = binding.binding ?? {};
  const identity = {
    candidateId: clean(b.candidateId),
    knownGoodRecordId: clean(b.knownGoodRecordId),
    replayId: clean(b.replayId),
    sourceCommitBefore: clean(b.sourceCommitBefore, 64),
    sourceCommitAfter: clean(b.sourceCommitAfter, 64),
  };
  if (Object.values(identity).some((v) => !v)) throw new Error("acceptance_binding_identity_missing");
  const now = new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.getTime())) throw new Error("invalid_record_time");
  return Object.freeze({
    version: VERSION,
    recordId: crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 32),
    recordedAt: now.toISOString(),
    ...identity,
    immutableManifestStatus: manifest.status,
    localJsonlOnly: true,
    persistenceAllowed: false,
    promotionAllowed: false,
    rollbackExecutionAllowed: false,
    productionRuntimeWiringAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
  });
}

function safeJson(line) {
  try { return JSON.parse(line); } catch { return null; }
}

export function appendAiLogicAcceptanceEvidenceRecord(binding = {}, options = {}) {
  const record = buildAiLogicAcceptanceEvidenceRecord(binding, options);
  const ledgerPath = path.resolve(
    options.ledgerPath ?? DEFAULT_AI_LOGIC_ACCEPTANCE_EVIDENCE_PATH,
  );
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(path.dirname(ledgerPath), 0o700); } catch {}

  const rows = fs.existsSync(ledgerPath)
    ? fs.readFileSync(ledgerPath, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  const parsed = rows.map(safeJson);
  if (parsed.some((row) => row === null)) {
    throw new Error("acceptance_evidence_ledger_malformed");
  }

  const duplicateSkipped = parsed.some((row) => row.recordId === record.recordId);
  if (!duplicateSkipped) {
    fs.appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
  try { fs.chmodSync(ledgerPath, 0o600); } catch {}

  return Object.freeze({
    appended: !duplicateSkipped,
    duplicateSkipped,
    recordId: record.recordId,
    ledgerPath,
    localJsonlOnly: true,
  });
}

export function listAiLogicAcceptanceEvidenceRecords(options = {}) {
  const ledgerPath = path.resolve(
    options.ledgerPath ?? DEFAULT_AI_LOGIC_ACCEPTANCE_EVIDENCE_PATH,
  );
  const rawLimit = Number(options.limit ?? 20);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(100, Math.trunc(rawLimit)))
    : 20;

  if (!fs.existsSync(ledgerPath)) return Object.freeze([]);

  const rows = fs.readFileSync(ledgerPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map(safeJson);
  if (rows.some((row) => row === null)) {
    throw new Error("acceptance_evidence_ledger_malformed");
  }

  return Object.freeze(
    rows.slice(-limit).reverse().map((row) => Object.freeze({ ...row })),
  );
}
