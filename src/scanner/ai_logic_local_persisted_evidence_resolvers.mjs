import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_PATH as DEFAULT_APPROVAL_PATH } from "./ai_logic_operator_approval_record.mjs";
import { DEFAULT_AI_LOGIC_PROMOTION_DECISION_EVIDENCE_PATH as DEFAULT_PROMOTION_PATH } from "./ai_logic_promotion_decision_evidence_store.mjs";
import { DEFAULT_AI_LOGIC_ROLLBACK_DECISION_EVIDENCE_PATH as DEFAULT_ROLLBACK_PATH } from "./ai_logic_rollback_decision_evidence_store.mjs";

export const VERSION = "ai_logic_local_persisted_evidence_resolvers_v1";

const LOCKS = Object.freeze([
  "productionRuntimeWiringAllowed","promotionExecutionAllowed","rollbackExecutionAllowed",
  "brokerContactAllowed","orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
  "allocationMutationAllowed","gitMutationAllowed",
]);
const DECISION_LOCKS = Object.freeze([
  "productionRuntimeWiringAllowed","persistenceAllowed","promotionAllowed",
  "promotionExecutionAllowed","rollbackExecutionAllowed","brokerContactAllowed",
  "orderPlacementAllowed","liveTradingAllowed","accountMutationAllowed",
  "immutablePolicyMutationAllowed","thresholdMutationAllowed","sizingMutationAllowed",
  "allocationMutationAllowed",
]);
const present = (v) => typeof v === "string" && v.trim().length > 0;
const idHash = (identity) =>
  crypto.createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0,32);

const closed = Object.freeze({
  readOnly:true,
  localJsonlOnly:true,
  runtimeWiringAllowed:false,
  productionRuntimeWiringAllowed:false,
  brokerContactAllowed:false,
  orderPlacementAllowed:false,
  liveTradingAllowed:false,
  accountMutationAllowed:false,
  immutablePolicyMutationAllowed:false,
  thresholdMutationAllowed:false,
  sizingMutationAllowed:false,
  allocationMutationAllowed:false,
  gitMutationAllowed:false,
});

function result(extra) {
  return Object.freeze({ version:VERSION, ...extra, ...closed });
}

function readLedger(filePath, malformedCode) {
  if (!fs.existsSync(filePath)) return [];
  const rows = [];
  for (const line of fs.readFileSync(filePath,"utf8").split(/\r\n?/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); }
    catch { throw new Error(malformedCode); }
  }
  return rows;
}

function exactlyOne(rows, recordId) {
  const matches = rows.filter((row) => row?.recordId === recordId);
  return matches.length === 1 ? matches[0] : null;
}

function approvalIdentity(row) {
  return {
    action:row?.action ?? null,
    decisionRecordId:row?.decisionRecordId ?? null,
    acceptanceRecordId:row?.acceptanceRecordId ?? null,
    candidateId:row?.candidateId ?? null,
    knownGoodRecordId:row?.knownGoodRecordId ?? null,
    replayId:row?.replayId ?? null,
    sourceCommitBefore:row?.sourceCommitBefore ?? null,
    sourceCommitAfter:row?.sourceCommitAfter ?? null,
    candidateSourceHash:row?.candidateSourceHash ?? null,
    nonce:row?.nonce ?? null,
  };
}

function canonicalApproval(row, requestedId) {
  if (
    row?.version !== "ai_logic_operator_approval_record_v1" ||
    row?.valid !== true ||
    row?.status !== "AI_LOGIC_OPERATOR_APPROVAL_RECORDED" ||
    row?.explicitlyApproved !== true ||
    row?.oneShot !== true ||
    row?.paperOnly !== true ||
    row?.localJsonlOnly !== true ||
    !["PROMOTION","ROLLBACK"].includes(row?.action) ||
    !present(row?.recordId) ||
    row.recordId !== requestedId
  ) return false;
  for (const key of ["decisionRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash","nonce"]) {
    if (!present(row[key])) return false;
  }
  if (row.action === "PROMOTION" && !present(row.acceptanceRecordId)) return false;
  for (const key of LOCKS) if (row[key] !== false) return false;
  const issued = Date.parse(row.issuedAt ?? "");
  const expires = Date.parse(row.expiresAt ?? "");
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || !(expires > issued)) return false;
  return idHash(approvalIdentity(row)) === row.recordId;
}

function decisionIdentity(row, action) {
  const keys = action === "PROMOTION"

    ? ["acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]
    : ["promotionDecisionRecordId","acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"];
  return Object.fromEntries(keys.map((key)=>[key,row?.[key] ?? null]));
}

function canonicalDecision(row, action, requestedId) {
  const promotion = action === "PROMOTION";
  const expectedVersion = promotion
    ? "ai_logic_promotion_decision_evidence_store_v1"
    : "ai_logic_rollback_decision_evidence_store_v1";
  if (
    row?.version !== expectedVersion ||
    row?.recordId !== requestedId ||
    row?.immutableManifestStatus !== "IMMUTABLE_MANIFEST_VERIFIED" ||
    row?.localJsonlOnly !== true
  ) return false;
  for (const key of Object.keys(decisionIdentity(row, action))) if (!present(row[key])) return false;
  for (const key of DECISION_LOCKS) if (row[key] !== false) return false;
  if (!promotion && (row.rollbackTargetIdentified !== true || row.rollbackDecisionEvidenceOnly !== true)) return false;
  return idHash(decisionIdentity(row, action)) === row.recordId;
}

function bindingMatchesApproval(decision, approval) {
  if (!approval || decision?.recordId !== approval.decisionRecordId) return false;
  for (const key of ["acceptanceRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash"]) {
    if ((approval[key] ?? null) !== (decision[key] ?? null)) return false;
  }
  return true;
}

export function resolveAiLogicOperatorApprovalById({ approvalRecordId } = {}, options = {}) {
  if (!present(approvalRecordId)) return result({ eligible:false, status:"AI_LOGIC_PERSISTED_APPROVAL_HOLD", reasons:Object.freeze(["APPROVAL_RECORD_ID_REQUIRED"]), record:null });
  const filePath = path.resolve(options.filePath ?? DEFAULT_APPROVAL_PATH);
  let rows;
  try { rows = readLedger(filePath,"AI_LOGIC_OPERATOR_APPROVAL_LEDGER_MALFORMED"); }
  catch { return result({ eligible:false, status:"AI_LOGIC_PERSISTED_APPROVAL_HOLD", reasons:Object.freeze(["APPROVAL_LEDGER_MALFORMED"]), record:null, filePath }); }
  const count = rows.filter((row)=>row?.recordId === approvalRecordId).length;
  if (count !== 1) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_APPROVAL_HOLD", reasons:Object.freeze([count === 0 ? "APPROVAL_NOT_FOUND" : "APPROVAL_DUPLICATE_ID"]), record:null, filePath });
  }
  const record = exactlyOne(rows, approvalRecordId);
  if (!canonicalApproval(record, approvalRecordId)) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_APPROVAL_HOLD", reasons:Object.freeze(["APPROVAL_IDENTITY_DRIFT"]), record:null, filePath });
  }
  return result({ eligible:true, status:"AI_LOGIC_PERSISTED_APPROVAL_RESOLVED", reasons:Object.freeze([]), record:Object.freeze({ ...record }), filePath });
}

export function resolveAiLogicDecisionEvidenceById({ action, decisionRecordId, operatorApproval } = {}, options = {}) {
  if (!["PROMOTION","ROLLBACK"].includes(action)) return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["ACTION_INVALID"]), record:null });
  if (!present(decisionRecordId)) return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["DECISION_RECORD_ID_REQUIRED"]), record:null });
  if (operatorApproval?.action !== action || operatorApproval?.decisionRecordId !== decisionRecordId) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["APPROVAL_DECISION_BINDING_MISMATCH"]), record:null });
  }
  const filePath = path.resolve(action === "PROMOTION"
    ? (options.promotionPath ?? DEFAULT_PROMOTION_PATH)
    : (options.rollbackPath ?? DEFAULT_ROLLBACK_PATH));
  let rows;
  try { rows = readLedger(filePath, action === "PROMOTION" ? "PROMOTION_DECISION_EVIDENCE_LEDGER_MALFORMED" : "ROLLBACK_DECISION_EVIDENCE_LEDGER_MALFORMED"); }
  catch { return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["DECISION_LEDGER_MALFORMED"]), record:null, filePath }); }
  const count = rows.filter((row)=>row?.recordId === decisionRecordId).length;
  if (count !== 1) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze([count === 0 ? "DECISION_NOT_FOUND" : "DECISION_DUPLICATE_ID"]), record:null, filePath });
  }
  const record = exactlyOne(rows, decisionRecordId);
  if (!canonicalDecision(record, action, decisionRecordId)) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["DECISION_IDENTITY_DRIFT"]), record:null, filePath });
  }
  if (!bindingMatchesApproval(record, operatorApproval)) {
    return result({ eligible:false, status:"AI_LOGIC_PERSISTED_DECISION_HOLD", reasons:Object.freeze(["APPROVAL_DECISION_BINDING_MISMATCH"]), record:null, filePath });
  }
  return result({ eligible:true, status:"AI_LOGIC_PERSISTED_DECISION_RESOLVED", reasons:Object.freeze([]), record:Object.freeze({ ...record }), filePath });
}

export function resolveAiLogicPersistedApprovalAndDecision({ approvalRecordId } = {}, options = {}) {
  const approval = resolveAiLogicOperatorApprovalById({ approvalRecordId }, { filePath:options.approvalPath });
  if (approval.eligible !== true) return result({ eligible:false, status:"AI_LOGIC_PERSISTED_EVIDENCE_HOLD", reasons:approval.reasons, operatorApproval:null, decisionEvidence:null });
  const decision = resolveAiLogicDecisionEvidenceById({
    action:approval.record.action,
    decisionRecordId:approval.record.decisionRecordId,
    operatorApproval:approval.record,
  }, {
    promotionPath:options.promotionPath,
    rollbackPath:options.rollbackPath,
  });
  if (decision.eligible !== true) return result({ eligible:false, status:"AI_LOGIC_PERSISTED_EVIDENCE_HOLD", reasons:decision.reasons, operatorApproval:approval.record, decisionEvidence:null });
  return result({
    eligible:true,
    status:"AI_LOGIC_PERSISTED_EVIDENCE_RESOLVED",
    reasons:Object.freeze([]),
    operatorApproval:approval.record,
    decisionEvidence:decision.record,
  });
}

export default Object.freeze({
  VERSION,
  resolveAiLogicOperatorApprovalById,
  resolveAiLogicDecisionEvidenceById,
  resolveAiLogicPersistedApprovalAndDecision,
});
