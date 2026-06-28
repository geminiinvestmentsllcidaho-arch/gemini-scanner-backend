import {writeReport} from "../src/scanner/paper_attempt_operator_review_packet.mjs";
const r=writeReport();
console.log(JSON.stringify({ok:r.ok,version:r.version,status:r.status,packetType:r.packetType,safety:r.safety,reviewDecision:r.reviewDecision,artifacts:r.artifacts,warnings:r.warnings,blockers:r.blockers,output:r.output,nextActions:r.nextActions},null,2));
console.log("\n"+r.compactHandoff);
