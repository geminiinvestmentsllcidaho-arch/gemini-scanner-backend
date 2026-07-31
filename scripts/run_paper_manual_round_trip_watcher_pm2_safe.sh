#!/usr/bin/env bash
set -euo pipefail
unset NODE_CHANNEL_FD NODE_UNIQUE_ID
scanner_pid="$(pm2 pid gemini-scanner)"
if [[ -z "$scanner_pid" || "$scanner_pid" == "0" || ! -r "/proc/$scanner_pid/environ" ]]; then
  echo "paper_manual_watcher_scanner_runtime_env_unavailable" >&2
  exit 2
fi
allowed='^(ALPACA_KEY|ALPACA_SECRET|ALPACA_API_KEY_ID|ALPACA_API_SECRET_KEY|ALPACA_KEY_ID|ALPACA_SECRET_KEY|APCA_API_KEY_ID|APCA_API_SECRET_KEY|ALPACA_PAPER_API_KEY|ALPACA_PAPER_API_SECRET|ALPACA_API_KEY|ALPACA_API_SECRET|ALPACA_PAPER_TRADING_BASE_URL|APCA_API_BASE_URL|ALPACA_PAPER_BASE_URL|ALPACA_BASE_URL|GEMINI_CREDENTIAL_MASTER_KEY)='
while IFS= read -r -d '' entry; do
  if [[ "$entry" =~ $allowed ]]; then export "$entry"; fi
done < "/proc/$scanner_pid/environ"
if [[ -z "${ALPACA_KEY:-${APCA_API_KEY_ID:-}}" || -z "${ALPACA_SECRET:-${APCA_API_SECRET_KEY:-}}" ]]; then
  echo "paper_manual_watcher_readonly_credentials_unavailable" >&2
  exit 2
fi
exec /usr/bin/node ./scripts/watch_paper_manual_round_trip_evidence.mjs "$@"
