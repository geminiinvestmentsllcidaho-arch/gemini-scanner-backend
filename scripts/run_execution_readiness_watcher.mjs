import {runExecutionReadinessOnce} from "../src/scanner/execution_readiness_runtime.mjs";

process.umask(0o077);

const waitMs=Math.max(
  15000,
  Number(process.env.GS_EXECUTION_READINESS_WATCH_INTERVAL_MS)||30000,
);

await runExecutionReadinessOnce();
setInterval(
  ()=>runExecutionReadinessOnce().catch(error=>console.error(error?.message??error)),
  waitMs,
);
