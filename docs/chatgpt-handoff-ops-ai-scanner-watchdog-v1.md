# GeminiScanner Ops AI Scanner Watchdog V1 — ChatGPT Handoff

## Repository and branch
- Remote: `gemini-vps`
- Repository: `~/apps/gemini-scanner-backend`
- Build branch: `feature/ops-ai-scanner-watchdog-v1`
- Branch base: deployed commit `cd3715ab4810be5408429d73a7919d4549b78104`
- Production deployment remains frozen until separately authorized.

## Authorized work
Build and test an always-on, read-only, fail-closed watchdog for GeminiScanner. Build authorization does not authorize deployment, PM2 changes, service restarts, scheduling, configuration mutation, or live notification tests.

## Runtime invariants
- `gemini-scanner`: online
- `gemini-paper-manual-watcher`: online
- Paper/live execution paths remain separate.
- Exact-position paper-only EXIT logic remains frozen.
- No order submission/cancellation, broker contact, account mutation, ENTER/live enablement, threshold mutation, blocker override, or trading-state change.

## Watchdog checks
- `/health` and `/readiness`
- Premarket scheduler state and session-aware freshness
- Post-market scheduler state, next wake, and expected-cycle completion
- Background AI worker enabled/running state, cadence, last success, and last error
- Recent completed OpenAI provider response with response ID
- Premarket evidence inclusion/freshness when applicable
- Post-market evidence inclusion/freshness after the expected cycle
- AI-review ledger and watchdog incident-state persistence
- All execution, broker, account, threshold, and mutation permissions remain locked
- PM2 process invariants, especially dry scanner stopped

## Alert behavior
- Recipient: `alerts@geminiscanner.net`
- Mailbox receiving capability was validated on 2026-08-06.
- Provider: existing Resend integration
- Current sender: `GeminiScanner <verify@mail.geminiscanner.net>`
- Transition-only failure and recovery alerts
- Deduplication, cooldown, persistence, and escalation for continuing incidents
- Session-aware checks to avoid false alarms outside applicable windows
- Never include secrets in source, logs, ledgers, fixtures, or alert bodies

## Architecture target
- Separate Node.js watchdog runner
- Deterministic check engine with injectable clock, HTTP, PM2, filesystem, and email adapters
- Persistent JSONL audit/incident ledger
- Read-only diagnostics; no automated remediation that mutates scanner or trading state
- Focused tests plus full repository regression suite

## Deployment boundary
Do not add/start a PM2 process, modify `.env`, configure the recipient, restart services, schedule execution, send production alerts, or deploy until the user gives separate explicit authorization.
