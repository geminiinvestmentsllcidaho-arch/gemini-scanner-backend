import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const VERSION = "ai_logic_operator_approval_record_v1";
export const DEFAULT_PATH = path.resolve("runs/ai_logic_operator_approvals.jsonl");
const ACTIONS = new Set(["PROMOTION","ROLLBACK"]);
const present = (v) => typeof v === "string" && v.trim().length > 0;
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0,32);

export function buildAiLogicOperatorApprovalRecord(input = {}) {
  const action = input.action;
  const fields = ["decisionRecordId","candidateId","knownGoodRecordId","replayId","sourceCommitBefore","sourceCommitAfter","candidateSourceHash","nonce"];
  const reasons = [];
  if (!ACTIONS.has(action)) reasons.push("ACTION_INVALID");
  for (const k of fields) if (!present(input[k])) reasons.push(`${k.toUpperCase()}_REQUIRED`);
  if (action === "PROMOTION" && !present(input.acceptanceRecordId)) reasons.push("ACCEPTANCERECORDID_REQUIRED");
  if (input.explicitlyApproved !== true) reasons.push("EXPLICIT_APPROVAL_REQUIRED");
  if (input.oneShot !== true) reasons.push("ONE_SHOT_REQUIRED");
  if (input.paperOnly !== true) reasons.push("PAPER_ONLY_REQUIRED");
  if (input.noLiveTradingAcknowledged !== true) reasons.push("NO_LIVE_TRADING_ACK_REQUIRED");
  if (input.noImmutablePolicyMutationAcknowledged !== true) reasons.push("NO_IMMUTABLE_MUTATION_ACK_REQUIRED");
  const issued = Date.parse(input.issuedAt ?? "");
  const expires = Date.parse(input.expiresAt ?? "");
  if (!Number.isFinite(issued)) reasons.push("ISSUED_AT_INVALID");
  if (!Number.isFinite(expires) || !(expires > issued)) reasons.push("EXPIRES_AT_INVALID");
  const identity = {
    action,
    decisionRecordId: input.decisionRecordId ?? null,
    acceptanceRecordId: input.acceptanceRecordId ?? null,
    candidateId: input.candidateId ?? null,
    knownGoodRecordId: input.knownGoodRecordId ?? null,
    replayId: input.replayId ?? null,
    sourceCommitBefore: input.sourceCommitBefore ?? null,
    sourceCommitAfter: input.sourceCommitAfter ?? null,
    candidateSourceHash: input.candidateSourceHash ?? null,
    nonce: input.nonce ?? null,
  };
  return Object.freeze({
    version: VERSION,
    valid: reasons.length === 0,
    status: reasons.length === 0 ? "AI_LOGIC_OPERATOR_APPROVAL_RECORDED" : "AI_LOGIC_OPERATOR_APPROVAL_REJECTED",
    reasons: Object.freeze(reasons),
    recordId: reasons.length === 0 ? hash(identity) : null,
    ...identity,
    explicitlyApproved: input.explicitlyApproved === true,
    oneShot: input.oneShot === true,
    issuedAt: Number.isFinite(issued) ? new Date(issued).toISOString() : null,
    expiresAt: Number.isFinite(expires) ? new Date(expires).toISOString() : null,
    paperOnly: true,
    localJsonlOnly: true,
    productionRuntimeWiringAllowed: false,
    promotionExecutionAllowed: false,
    rollbackExecutionAllowed: false,
    brokerContactAllowed: false,
    orderPlacementAllowed: false,
    liveTradingAllowed: false,
    accountMutationAllowed: false,
    immutablePolicyMutationAllowed: false,
    thresholdMutationAllowed: false,
    sizingMutationAllowed: false,
    allocationMutationAllowed: false,
    gitMutationAllowed: false,
  });
}

export function appendAiLogicOperatorApprovalRecord(record, filePath = DEFAULT_PATH) {
  if (record?.version !== VERSION || record?.valid !== true || !present(record?.recordId)) throw new Error("operator_approval_record_invalid");
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  let rows = [];
  if (fs.existsSync(filePath)) {
    rows = fs.readFileSync(filePath,"utf8").split("\n").filter(Boolean).map((line)=>JSON.parse(line));
    if (rows.some((r)=>r.recordId === record.recordId)) return Object.freeze({appended:false,record});
  }
  fs.appendFileSync(filePath, JSON.stringify(record)+"\n", { mode: 0o600 });
  fs.chmodSync(filePath,0o600);
  return Object.freeze({appended:true,record});
}
