import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {VERSION,buildPacket,writeReport} from "../src/scanner/paper_attempt_operator_review_packet.mjs";
function root(){const r=fs.mkdtempSync(path.join(os.tmpdir(),"op-review-"));fs.mkdirSync(path.join(r,"runs"),{recursive:true});return r}
function w(r,f,o={ok:true}){fs.writeFileSync(path.join(r,"runs",f),JSON.stringify(o)+"\n")}
test("operator review packet is review-only and cannot place orders",()=>{const r=root();w(r,"paper_attempt_safety_finalization_1.json",{ok:true,safety:{safetyLocksOk:true}});w(r,"compact_handoff_paper_attempt_safety_finalization_1.txt");w(r,"paper_attempt_control_center_1.json");w(r,"manual_paper_trading_readiness_audit_1.json");w(r,"first_tiny_paper_order_control_path_1.json");const p=buildPacket({projectRoot:r,now:"2026-06-27T00:00:00.000Z"});assert.equal(p.ok,true);assert.equal(p.version,VERSION);assert.equal(p.safety.reviewOnly,true);assert.equal(p.safety.brokerOrderPlacementAllowed,false);assert.equal(p.reviewDecision.canApproveOrderPlacement,false);assert.ok(p.blockers.includes("order_placement_still_blocked"))});
test("operator review packet blocks missing artifacts and writes handoff",()=>{const r=root();w(r,"paper_attempt_safety_finalization_1.json",{ok:true,safety:{safetyLocksOk:true}});const p=writeReport({projectRoot:r,now:"2026-06-27T00:00:00.000Z"});assert.equal(p.ok,false);assert.ok(p.warnings.includes("required_artifact_missing:controlCenter"));assert.equal(fs.existsSync(path.join(r,p.output.jsonPath)),true);const h=fs.readFileSync(path.join(r,p.output.handoffPath),"utf8");assert.match(h,/BEGIN GEMINISCANNER COMPACT HANDOFF/);assert.match(h,/GS_RUN_B64_V1/)});
